// 데스크톱(Tauri/맥) 전용 알림 브리지.
//
// WKWebView 는 웹푸시(FCM)를 지원하지 않으므로(기획 3.2), 맥앱에서는 백엔드가 기록한
// notifications 문서를 실시간 구독해 OS 로컬 알림으로 띄운다. 동일한 웹 번들이 브라우저에서도
// 로드되므로, Tauri 런타임일 때만 활성화하고 그 외에는 아무 것도 하지 않는다.
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getDb } from "./firebase";

/** 현재 런타임이 Tauri(데스크톱) 인지 — 브라우저에서는 false. */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * notifications 컬렉션을 구독해 신규 push 알림을 OS 로컬 알림으로 띄운다.
 * @returns 구독 해제 함수. Tauri 가 아니면 no-op 을 반환한다.
 */
export function startDesktopNotificationBridge(uid: string): () => void {
  if (!isTauri() || !uid) return () => {};

  // 첫 스냅샷(기존 발송 로그)은 알림 없이 seen 에 적재하고, 그 이후 추가되는 문서만
  // OS 알림으로 띄운다. createdAt(서버 시계)을 클라이언트 시계와 비교하지 않으므로
  // 기기/서버 시계 차이로 첫 알림을 놓치거나 백로그가 새는 문제가 없다.
  const seen = new Set<string>();
  let initialized = false;

  const q = query(
    collection(getDb(), "notifications"),
    where("uid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(20),
  );

  const unsub = onSnapshot(q, (snap) => {
    for (const change of snap.docChanges()) {
      if (change.type !== "added") continue;
      const doc = change.doc;
      if (seen.has(doc.id)) continue;
      seen.add(doc.id);

      // 첫 스냅샷의 기존 문서는 알림하지 않음 — 과거 발송 로그 폭주 방지.
      if (!initialized) continue;

      const data = doc.data();
      // 데스크톱은 push 채널만 OS 알림으로(이메일은 백엔드가 별도 발송).
      if (data.channel !== "push") continue;

      void fireLocalNotification(
        (data.title as string) ?? "Routizen",
        (data.body as string) ?? "",
      );
    }
    initialized = true;
  });

  return unsub;
}

/**
 * 현재 네이티브 알림 권한 상태 확인 (권한 요청 없음).
 * macOS: isPermissionGranted()는 "denied"와 "not-asked" 모두 false를 반환하므로
 * 두 경우를 구분할 수 없다. false → "default" 로 반환하며, 실제 거부 여부는
 * requestNativePermission() 호출 후에만 알 수 있다.
 */
export async function getNativePermission(): Promise<"granted" | "default"> {
  const { isPermissionGranted } = await import("@tauri-apps/plugin-notification");
  return (await isPermissionGranted()) ? "granted" : "default";
}

/** 네이티브 알림 권한 요청. 이미 거부된 경우 OS 대화상자 없이 "denied" 반환. */
export async function requestNativePermission(): Promise<"granted" | "denied" | "default"> {
  const { requestPermission } = await import("@tauri-apps/plugin-notification");
  return requestPermission();
}

/** @tauri-apps/plugin-notification 으로 OS 알림 발송. 권한이 없으면 무시한다. */
async function fireLocalNotification(title: string, body: string): Promise<void> {
  const { isPermissionGranted, sendNotification } = await import(
    "@tauri-apps/plugin-notification"
  );
  if (await isPermissionGranted()) {
    await sendNotification({ title, body });
  }
}

/** 로그인 시 자동 실행 여부를 반환한다. */
export async function getAutostart(): Promise<boolean> {
  const { isEnabled } = await import("@tauri-apps/plugin-autostart");
  return isEnabled();
}

/** 로그인 시 자동 실행을 켜거나 끈다. */
export async function setAutostart(enabled: boolean): Promise<void> {
  const { enable, disable } = await import("@tauri-apps/plugin-autostart");
  if (enabled) await enable();
  else await disable();
}
