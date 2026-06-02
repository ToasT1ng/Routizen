import type { AlarmStage, User } from "@routizen/core";
import { pickMessage } from "@routizen/core";
import { FieldValue } from "firebase-admin/firestore";
import { Resend } from "resend";
import { CONFIG } from "./config.js";
import { db, messaging } from "./firebaseAdmin.js";

const resend = CONFIG.resendApiKey ? new Resend(CONFIG.resendApiKey) : null;

/**
 * 알림 발송: PUSH(모든 단계) + EMAIL(마지막 단계만, 기획 2.5).
 * 발송 내역은 notifications 컬렉션에 기록 → 맥(Tauri) 실시간 리스너가 구독.
 */
export async function sendAlarmNotification(params: {
  user: User;
  instanceId: string;
  scheduleId: string;
  title: string;
  stage: AlarmStage;
}): Promise<void> {
  const { user, instanceId, scheduleId, title, stage } = params;
  const body = pickMessage(user.alarmStyle, stage, title);
  const heading = stage === "final" ? "마지막 알림" : "Routizen";

  // 1) PUSH (FCM 멀티캐스트) — 웹/안드/iOS. 맥은 아래 notifications 문서로 처리.
  // data-only 메시지로 발송: notification 페이로드를 넣으면 웹에서 SDK 자동 표시 +
  // onBackgroundMessage 가 동시에 동작해 알림이 중복된다. 표시는 클라이언트(SW/포그라운드)가 전담.
  const tokens = user.fcmTokens.map((t) => t.token).filter(Boolean);
  if (tokens.length > 0) {
    await messaging.sendEachForMulticast({
      tokens,
      data: { title: heading, body, instanceId, scheduleId, stage },
    });
  }

  // 2) notifications 문서 기록 (맥 Tauri 실시간 리스너 + 발송 로그)
  await db.collection("notifications").add({
    uid: user.uid,
    instanceId,
    scheduleId,
    channel: "push",
    stage,
    style: user.alarmStyle,
    title: heading,
    body,
    createdAt: FieldValue.serverTimestamp(),
    delivered: true,
  });

  // 3) EMAIL — 마지막 알람에만 (기획 2.5)
  if (stage === "final" && user.email) {
    if (resend) {
      await resend.emails.send({
        from: CONFIG.fromEmail,
        to: user.email,
        subject: `[Routizen] ${title} — 마지막 알림`,
        text: body,
      });
    }
    await db.collection("notifications").add({
      uid: user.uid,
      instanceId,
      scheduleId,
      channel: "email",
      stage,
      style: user.alarmStyle,
      title: heading,
      body,
      createdAt: FieldValue.serverTimestamp(),
      delivered: Boolean(resend),
    });
  }
}
