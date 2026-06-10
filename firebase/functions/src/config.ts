/**
 * 런타임 환경설정. Firebase Functions v2 환경변수/시크릿으로 주입.
 * (firebase functions:secrets:set RESEND_API_KEY 등)
 */
export const CONFIG = {
  /** GCP 프로젝트/리전 (Cloud Tasks 큐 위치와 일치해야 함) */
  region: process.env.FUNCTIONS_REGION ?? "asia-northeast3",
  /** Cloud Tasks 큐 이름 */
  taskQueue: process.env.ALARM_TASK_QUEUE ?? "routizen-alarms",
  /** onAlarmTask HTTP 함수의 공개 URL (배포 후 설정) */
  alarmTaskUrl: process.env.ALARM_TASK_URL ?? "",
  /** Cloud Tasks → 함수 호출 시 사용할 서비스 계정 이메일 (OIDC) */
  taskInvokerSA: process.env.TASK_INVOKER_SA ?? "",
  /** onAlarmTask 호출 검증용 공유 시크릿 (Cloud Tasks 헤더로 전달). 미설정 시 검증 생략(에뮬레이터) */
  taskSecret: process.env.TASK_SECRET ?? "",
  /** Resend 이메일 */
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  fromEmail: process.env.FROM_EMAIL ?? "Routizen <noreply@routizen.app>",
  /** 운영 타임존 (현재 KST 고정 — 추후 사용자별 확장) */
  timezone: "Asia/Seoul",
  /** Stripe 결제 (기획 3.5) */
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  /** Stripe 웹훅 서명 검증 시크릿 (whsec_...) */
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  /** 프리미엄 구독 Price ID (price_...) */
  stripePriceId: process.env.STRIPE_PRICE_ID ?? "",
  /** Checkout 성공/취소 후 돌아올 웹앱 기본 URL */
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
} as const;

export const FINAL_REALARM_DELAY_MS = 60 * 60 * 1000; // 끝시간 +1시간
