"use client";

import type { FcmTokenEntry, Repositories } from "@routizen/core";
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type Messaging,
} from "firebase/messaging";
import { firebaseConfig, getFirebaseApp } from "./firebase";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

/** FCM 웹 푸시 지원 여부(서비스워커/Notification API + iOS Safari 등 제약 포함). */
export async function isPushSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return false;
  return isSupported();
}

let cachedMessaging: Messaging | null = null;
function messaging(): Messaging {
  if (!cachedMessaging) cachedMessaging = getMessaging(getFirebaseApp());
  return cachedMessaging;
}

/**
 * 서비스워커 등록. SW 는 빌드 타임 env 를 못 읽으므로 Firebase 설정을
 * 쿼리스트링으로 넘겨 SW 내부에서 firebase.initializeApp 에 사용한다.
 */
async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const params = new URLSearchParams(
    Object.entries(firebaseConfig).reduce<Record<string, string>>((acc, [k, v]) => {
      if (v) acc[k] = String(v);
      return acc;
    }, {}),
  );
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params.toString()}`);
}

export type PushEnableResult =
  | { ok: true; token: string }
  | { ok: false; reason: "unsupported" | "denied" | "no-vapid" | "error"; error?: unknown };

/**
 * 푸시 알림 활성화: 권한 요청 → SW 등록 → FCM 토큰 발급 → user.fcmTokens 업서트.
 * 사용자 제스처(버튼 클릭)에서 호출해야 권한 프롬프트가 안정적으로 뜬다.
 */
export async function enablePush(uid: string, repos: Repositories): Promise<PushEnableResult> {
  try {
    if (!(await isPushSupported())) return { ok: false, reason: "unsupported" };
    if (!VAPID_KEY) return { ok: false, reason: "no-vapid" };

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "denied" };

    const registration = await registerServiceWorker();
    const token = await getToken(messaging(), {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return { ok: false, reason: "error" };

    const entry: FcmTokenEntry = { token, platform: "web", updatedAt: Date.now() };
    await repos.users.addFcmToken(uid, entry);
    return { ok: true, token };
  } catch (error) {
    return { ok: false, reason: "error", error };
  }
}

/**
 * 포그라운드(탭이 열려 있을 때) 메시지 수신 → OS 알림 표시.
 * 백그라운드는 SW 의 onBackgroundMessage 가 처리한다. 발송은 data-only 이므로
 * 제목/본문은 payload.data 에서 읽는다(notify.ts 참조).
 * 표시는 SW registration.showNotification 을 사용 — new Notification() 은 모바일
 * Chrome 등에서 throw 하므로 플랫폼 호환을 위해 SW 경유로 통일.
 * @returns 구독 해제 함수
 */
export async function listenForegroundMessages(): Promise<() => void> {
  if (!(await isPushSupported())) return () => {};
  return onMessage(messaging(), (payload) => {
    const data = payload.data ?? {};
    const title = data.title ?? "Routizen";
    const body = data.body ?? "";
    if (Notification.permission !== "granted") return;
    void navigator.serviceWorker.ready.then((registration) =>
      registration.showNotification(title, { body, icon: "/icon-192.png", data }),
    );
  });
}
