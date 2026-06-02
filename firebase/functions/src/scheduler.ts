import { occursOn, timeOnDate, toDateKey, type Schedule } from "@routizen/core";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { CONFIG, FINAL_REALARM_DELAY_MS } from "./config.js";
import { db } from "./firebaseAdmin.js";
import { enqueueAlarmTask } from "./tasks.js";

/**
 * 매일 KST 00:05 — 당일 발생하는 일정을 AlarmInstance 로 생성하고
 * 시작/끝/마지막/정리 Cloud Task 를 예약한다 (기획 3.3).
 *
 * NOTE: 시각 계산은 로컬 타임존 기준이므로 함수 런타임 TZ 를 Asia/Seoul 로
 * 설정해야 한다(현재 KST 운영 가정 — 추후 사용자별 타임존 확장).
 */
export const materializeDailyAlarms = onSchedule(
  { schedule: "5 0 * * *", timeZone: CONFIG.timezone, region: CONFIG.region },
  async () => {
    await materializeForDate(new Date());
  },
);

export async function materializeForDate(date: Date): Promise<number> {
  const dateKey = toDateKey(date);
  const snap = await db.collection("schedules").where("active", "==", true).get();

  let created = 0;
  for (const docSnap of snap.docs) {
    const schedule = { id: docSnap.id, ...docSnap.data() } as Schedule;
    if (!occursOn(schedule.recurrence, date)) continue;

    // 결정적 인스턴스 ID → 중복 생성 방지(멱등)
    const instanceId = `${schedule.id}_${dateKey}`;
    const ref = db.collection("alarmInstances").doc(instanceId);
    if ((await ref.get()).exists) continue;

    const startAt = timeOnDate(date, schedule.startTime);
    const endAt = timeOnDate(date, schedule.endTime);
    if (startAt == null || endAt == null) continue;

    await ref.set({
      uid: schedule.uid,
      scheduleId: schedule.id,
      date: dateKey,
      startAt,
      endAt,
      state: "SCHEDULED",
    });
    created++;

    // 정시 콜백 예약: 시작 → 끝 → (끝+1h)마지막 → 정리
    await enqueueAlarmTask({ instanceId, kind: "START" }, startAt);
    await enqueueAlarmTask({ instanceId, kind: "END" }, endAt);
    await enqueueAlarmTask({ instanceId, kind: "FINAL" }, endAt + FINAL_REALARM_DELAY_MS);
    await enqueueAlarmTask(
      { instanceId, kind: "EXPIRE" },
      endAt + FINAL_REALARM_DELAY_MS + 5 * 60 * 1000,
    );

    // 프리미엄 추가 알람 슬롯
    for (const slot of schedule.extraAlarms ?? []) {
      const at = timeOnDate(date, slot);
      if (at != null) await enqueueAlarmTask({ instanceId, kind: "EXTRA", slot }, at);
    }
  }
  return created;
}
