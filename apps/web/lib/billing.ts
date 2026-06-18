"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebase";

// Functions 배포 리전(알람 큐와 동일 — firebase/functions/src/config.ts 의 FUNCTIONS_REGION 과
// 일치해야 함). 기본값은 양쪽 다 asia-northeast3.
const REGION = process.env.NEXT_PUBLIC_FUNCTIONS_REGION ?? "asia-northeast3";

export type CheckoutError = "already-premium" | "not-configured" | "error";
/**
 * "external" — Tauri 환경에서 외부 브라우저로 Stripe 를 열었음.
 *   결제 완료 후 앱 포커스 복귀를 기다려야 함.
 * null — 정상 리다이렉트(브라우저). 이후 반환 없음.
 */
export type CheckoutResult = CheckoutError | "external" | null;

/** Tauri Webview 내부인지 감지(런타임 전용 — SSR 에서는 항상 false). */
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Tauri 환경에서 URL 을 기본 브라우저로 엽니다(tauri-plugin-shell 공식 API 사용). */
async function openInBrowser(url: string): Promise<void> {
  const { open } = await import("@tauri-apps/plugin-shell");
  await open(url);
}

/**
 * 프리미엄 구독 Checkout 시작 (기획 3.5).
 * - 브라우저: createCheckoutSession 콜러블 → Stripe Checkout URL 로 현재 탭 이동(정상 흐름에서는 반환 없음).
 * - Tauri 맥앱: 동일 URL 을 기본 브라우저로 열고 "external" 을 반환. 결제 후 앱 포커스 복귀 시 프리미엄 상태를 폴링한다.
 * 실패 시 사유를 반환.
 */
export async function startPremiumCheckout(): Promise<CheckoutResult> {
  try {
    const fns = getFunctions(getFirebaseApp(), REGION);
    const call = httpsCallable<unknown, { url: string }>(fns, "createCheckoutSession");
    const { data } = await call();
    if (!data?.url) return "error";
    if (isTauri()) {
      await openInBrowser(data.url);
      return "external";
    }
    window.location.assign(data.url);
    return null;
  } catch (err) {
    // Firebase 콜러블 에러 코드는 "functions/already-exists" 형태.
    const code = (err as { code?: string }).code ?? "";
    if (code.includes("already-exists")) return "already-premium";
    if (code.includes("failed-precondition")) return "not-configured";
    return "error";
  }
}
