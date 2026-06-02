// 운영 타임존을 KST 로 고정 (현재 KST 운영 가정 — 기획). 미설정 시 컨테이너 TZ(UTC)
// 기준으로 날짜/시각이 계산되어 cron 머터리얼라이즈 날짜와 알람 시각이 어긋난다.
// Node 는 process.env.TZ 할당 시 즉시 타임존을 재설정한다.
process.env.TZ = process.env.TZ ?? "Asia/Seoul";

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

if (!getApps().length) {
  initializeApp();
}

export const db = getFirestore();
export const messaging = getMessaging();
