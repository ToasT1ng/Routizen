import type { User } from "./types.js";

/** 무료 사용자의 활성 일정 최대 개수 (기획 2.6) */
export const FREE_SCHEDULE_LIMIT = 10;

/** 프리미엄 미제공 안내 문구 (기획 2.6 — 초기 단계) */
export const PREMIUM_LOCKED_MESSAGE = "유료 기능입니다. 아직 제공되지 않습니다.";

/** 새 일정을 등록할 수 있는지 (무료는 10개 제한) */
export function canCreateSchedule(
  isPremium: boolean,
  activeScheduleCount: number,
): boolean {
  if (isPremium) return true;
  return activeScheduleCount < FREE_SCHEDULE_LIMIT;
}

/** 추가 알람 슬롯(프리미엄 전용)을 사용할 수 있는지 */
export function canUseExtraAlarms(isPremium: boolean): boolean {
  return isPremium;
}

/** 남은 무료 일정 슬롯 수 (프리미엄이면 Infinity) */
export function remainingFreeSlots(user: Pick<User, "isPremium">, activeCount: number): number {
  if (user.isPremium) return Number.POSITIVE_INFINITY;
  return Math.max(0, FREE_SCHEDULE_LIMIT - activeCount);
}
