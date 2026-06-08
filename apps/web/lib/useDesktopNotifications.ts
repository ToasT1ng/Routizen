"use client";

import { useEffect } from "react";
import { startDesktopNotificationBridge } from "./desktopNotifications";

/**
 * 로그인 상태에서 데스크톱(Tauri) 로컬 알림 브리지를 구동한다.
 * 브라우저 런타임에서는 브리지가 no-op 이므로 안전하게 호출할 수 있다.
 */
export function useDesktopNotifications(uid: string | null | undefined): void {
  useEffect(() => {
    if (!uid) return;
    const unsub = startDesktopNotificationBridge(uid);
    return unsub;
  }, [uid]);
}
