/**
 * Routizen 도메인 타입.
 * 백엔드(Firestore) 구현과 독립적인 순수 타입 — 추상화 레이어의 기반.
 */

/** 사용자 전역 알람 스타일 (일정별이 아님 — 기획 2.4) */
export type AlarmStyle = "normal" | "push";

/** 알람 단계 */
export type AlarmStage = "start" | "end" | "final" | "extra";

/** 알림 채널 */
export type NotificationChannel = "push" | "email";

/** 반복 유형 */
export type RecurrenceType = "once" | "daily" | "weekly" | "monthly";

/** 월별 구분: 초(1-10) / 중(11-20) / 말(21-월말) — 기획 2.1 */
export type MonthlyPart = "early" | "mid" | "late";

/** 요일: 0=일요일 ... 6=토요일 (JS Date.getDay() 규약) */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Recurrence {
  type: RecurrenceType;
  /** weekly 일 때 사용할 요일 목록 */
  weekdays?: Weekday[];
  /** monthly 일 때 사용할 구분 */
  monthlyPart?: MonthlyPart;
  /** once 일 때의 날짜 (YYYY-MM-DD) */
  date?: string;
}

export interface SubscriptionInfo {
  provider: "stripe" | "revenuecat" | null;
  status: "active" | "canceled" | "none";
  currentPeriodEnd: number | null;
}

export interface FcmTokenEntry {
  token: string;
  platform: "web" | "macos" | "ios" | "android";
  updatedAt: number;
}

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  /** 초기엔 항상 false (결제 미연동 — 기획 3.5) */
  isPremium: boolean;
  subscription: SubscriptionInfo;
  /** 사용자 전역 알람 스타일 */
  alarmStyle: AlarmStyle;
  fcmTokens: FcmTokenEntry[];
  /** 추후 타임존 대응용 (현재 KST 기준) */
  timezone: string;
}

export interface Schedule {
  id: string;
  uid: string;
  title: string;
  memo?: string;
  recurrence: Recurrence;
  /** "HH:mm" */
  startTime: string;
  /** "HH:mm" */
  endTime: string;
  /** 프리미엄 추가 알람 슬롯 — "HH:mm"[] (무료는 빈 배열) */
  extraAlarms: string[];
  active: boolean;
}

/**
 * 알람 인스턴스 상태 (기획 2.3 상태 머신)
 * SCHEDULED → STARTED → DONE
 *                 └→ OVERDUE → FINAL_NOTIFIED → MISSED
 */
export type AlarmState =
  | "SCHEDULED"
  | "STARTED"
  | "DONE"
  | "OVERDUE"
  | "FINAL_NOTIFIED"
  | "MISSED";

export interface AlarmInstance {
  id: string;
  uid: string;
  scheduleId: string;
  /** YYYY-MM-DD */
  date: string;
  /** epoch ms */
  startAt: number;
  /** epoch ms */
  endAt: number;
  state: AlarmState;
  completedAt?: number;
}
