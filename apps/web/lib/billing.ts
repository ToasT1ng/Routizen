"use client";

import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./firebase";

// Functions 는 asia-northeast3 에 배포됨(알람 큐와 동일 리전 — firebase/functions/src/config.ts).
const REGION = "asia-northeast3";

export type CheckoutError = "already-premium" | "not-configured" | "error";

/**
 * 프리미엄 구독 Checkout 시작 (기획 3.5).
 * createCheckoutSession 콜러블을 호출해 받은 Stripe Checkout URL 로 현재 탭을 이동시킨다.
 * 성공 시 리다이렉트되므로 정상 흐름에서는 반환하지 않는다. 실패 시 사유를 반환.
 */
export async function startPremiumCheckout(): Promise<CheckoutError | null> {
  try {
    const fns = getFunctions(getFirebaseApp(), REGION);
    const call = httpsCallable<unknown, { url: string }>(fns, "createCheckoutSession");
    const { data } = await call();
    if (!data?.url) return "error";
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
