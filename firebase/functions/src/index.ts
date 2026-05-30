import "./firebaseAdmin.js"; // Admin SDK 초기화 (사이드이펙트)

export { materializeDailyAlarms } from "./scheduler.js";
export { onAlarmTask } from "./onAlarmTask.js";

// 결제(billing) 웹훅은 결제 연동 단계에서 추가 — 기획 3.5 (초기 미연동)

// --- 로컬/에뮬레이터 테스트용 수동 트리거 -----------------------------------
import { onRequest } from "firebase-functions/v2/https";
import { CONFIG } from "./config.js";
import { materializeForDate } from "./scheduler.js";

/**
 * 에뮬레이터에서 당일(또는 ?date=YYYY-MM-DD) 알람 인스턴스를 즉시 생성.
 * 운영 배포 시에는 비활성화/보호 필요.
 */
export const materializeNow = onRequest({ region: CONFIG.region }, async (req, res) => {
  const dateParam = typeof req.query.date === "string" ? req.query.date : undefined;
  const date = dateParam ? new Date(`${dateParam}T00:00:00`) : new Date();
  const created = await materializeForDate(date);
  res.status(200).json({ date: dateParam ?? "today", created });
});
