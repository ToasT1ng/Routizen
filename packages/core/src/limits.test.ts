import { describe, expect, it } from "vitest";
import {
  canCreateSchedule,
  canUseExtraAlarms,
  FREE_SCHEDULE_LIMIT,
  remainingFreeSlots,
} from "./limits.js";

describe("canCreateSchedule — 무료 10개 제한", () => {
  it("무료: 9개면 등록 가능, 10개면 차단", () => {
    expect(canCreateSchedule(false, 9)).toBe(true);
    expect(canCreateSchedule(false, FREE_SCHEDULE_LIMIT)).toBe(false);
    expect(canCreateSchedule(false, 11)).toBe(false);
  });

  it("프리미엄: 제한 없음", () => {
    expect(canCreateSchedule(true, 100)).toBe(true);
  });
});

describe("canUseExtraAlarms — 프리미엄 전용", () => {
  it("무료는 불가, 프리미엄은 가능", () => {
    expect(canUseExtraAlarms(false)).toBe(false);
    expect(canUseExtraAlarms(true)).toBe(true);
  });
});

describe("remainingFreeSlots", () => {
  it("무료: 남은 슬롯 계산", () => {
    expect(remainingFreeSlots({ isPremium: false }, 3)).toBe(7);
    expect(remainingFreeSlots({ isPremium: false }, 10)).toBe(0);
    expect(remainingFreeSlots({ isPremium: false }, 12)).toBe(0);
  });

  it("프리미엄: 무한", () => {
    expect(remainingFreeSlots({ isPremium: true }, 50)).toBe(Number.POSITIVE_INFINITY);
  });
});
