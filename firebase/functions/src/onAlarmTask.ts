import {
  transition,
  type AlarmEvent,
  type AlarmInstance,
  type AlarmStage,
  type User,
} from "@routizen/core";
import { onRequest } from "firebase-functions/v2/https";
import { CONFIG } from "./config.js";
import { db } from "./firebaseAdmin.js";
import { sendAlarmNotification } from "./notify.js";
import type { AlarmTaskPayload } from "./tasks.js";

/**
 * Cloud Tasks 가 예약 시각에 호출하는 HTTP 핸들러.
 * 상태머신 전이를 트랜잭션으로 처리해 **멱등성**을 보장한다 (기획 3.3):
 * 중복 호출이나 이미 "실행했음"(DONE) 인 경우 알림을 보내지 않는다.
 */
export const onAlarmTask = onRequest({ region: CONFIG.region }, async (req, res) => {
  const payload = req.body as AlarmTaskPayload;
  if (!payload?.instanceId || !payload?.kind) {
    res.status(400).send("bad payload");
    return;
  }

  const ref = db.collection("alarmInstances").doc(payload.instanceId);

  // EXTRA(프리미엄 추가 슬롯): 상태 변화 없이 push 만 발송
  if (payload.kind === "EXTRA") {
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(200).send("gone");
      return;
    }
    const inst = { id: snap.id, ...snap.data() } as AlarmInstance;
    if (inst.state !== "DONE" && inst.state !== "MISSED") {
      await notifyForInstance(inst, "extra");
    }
    res.status(200).send("ok");
    return;
  }

  // 상태머신 전이 (트랜잭션)
  let notifyStage: AlarmStage | null = null;
  let instForNotify: AlarmInstance | null = null;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const inst = { id: snap.id, ...snap.data() } as AlarmInstance;
    const result = transition(inst.state, payload.kind as AlarmEvent);
    if (!result.changed) return;
    tx.update(ref, { state: result.next });
    notifyStage = result.notify;
    instForNotify = { ...inst, state: result.next };
  });

  if (notifyStage && instForNotify) {
    await notifyForInstance(instForNotify, notifyStage);
  }
  res.status(200).send("ok");
});

async function notifyForInstance(inst: AlarmInstance, stage: AlarmStage): Promise<void> {
  const [schedSnap, userSnap] = await Promise.all([
    db.collection("schedules").doc(inst.scheduleId).get(),
    db.collection("users").doc(inst.uid).get(),
  ]);
  if (!userSnap.exists) return;
  const user = { uid: userSnap.id, ...userSnap.data() } as User;
  const title = (schedSnap.data()?.title as string | undefined) ?? "루틴";
  await sendAlarmNotification({
    user,
    instanceId: inst.id,
    scheduleId: inst.scheduleId,
    title,
    stage,
  });
}
