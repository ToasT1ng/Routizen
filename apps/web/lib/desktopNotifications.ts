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
  Timestamp,
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

  // 브리지 시작 이후 생성된 문서만 알림 — 과거 발송 로그가 무더기로 뜨는 것을 방지.
  const since = Timestamp.now();
  const seen = new Set<string>();

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

      const data = doc.data();
      // 데스크톱은 push 채널만 OS 알림으로(이메일은 백엔드가 별도 발송).
      if (data.channel !== "push") continue;

      const createdAt = data.createdAt as Timestamp | null;
      // serverTimestamp 반영 전(로컬 추정값 null)이거나 시작 이전 문서는 건너뛴다.
      if (!createdAt || createdAt.toMillis() <= since.toMillis()) continue;

      seen.add(doc.id);
      void fireLocalNotification(
        (data.title as string) ?? "Routizen",
        (data.body as string) ?? "",
      );
    }
  });

  return unsub;
}

/** @tauri-apps/plugin-notification 으로 OS 알림 발송 (권한 미허용 시 요청). */
async function fireLocalNotification(title: string, body: string): Promise<void> {
  // Tauri 전용 모듈 — 브라우저 번들에 정적 포함되지 않도록 동적 import.
  const { isPermissionGranted, requestPermission, sendNotification } = await import(
    "@tauri-apps/plugin-notification"
  );
  let granted = await isPermissionGranted();
  if (!granted) {
    granted = (await requestPermission()) === "granted";
  }
  if (granted) {
    sendNotification({ title, body });
  }
}
