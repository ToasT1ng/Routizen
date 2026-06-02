import { describe, expect, it } from "vitest";
import { monthlyPartForDay, occursOn, timeOnDate, toDateKey } from "./recurrence.js";
import type { Recurrence } from "./types.js";

describe("monthlyPartForDay — 초/중/말 (1-10 / 11-20 / 21-말일)", () => {
  it("초: 1~10", () => {
    expect(monthlyPartForDay(1)).toBe("early");
    expect(monthlyPartForDay(10)).toBe("early");
  });
  it("중: 11~20", () => {
    expect(monthlyPartForDay(11)).toBe("mid");
    expect(monthlyPartForDay(20)).toBe("mid");
  });
  it("말: 21~월말", () => {
    expect(monthlyPartForDay(21)).toBe("late");
    expect(monthlyPartForDay(31)).toBe("late");
  });
});

describe("toDateKey", () => {
  it("YYYY-MM-DD 로 포맷, 0 패딩", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toDateKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("occursOn", () => {
  it("once: 지정 날짜에만 발생", () => {
    const r: Recurrence = { type: "once", date: "2026-06-15" };
    expect(occursOn(r, new Date(2026, 5, 15))).toBe(true);
    expect(occursOn(r, new Date(2026, 5, 16))).toBe(false);
  });

  it("daily: 매일 발생", () => {
    const r: Recurrence = { type: "daily" };
    expect(occursOn(r, new Date(2026, 5, 1))).toBe(true);
    expect(occursOn(r, new Date(2026, 5, 2))).toBe(true);
  });

  it("weekly: 선택 요일에만 발생 (월/수/금)", () => {
    // 0=일 1=월 ... 5=금 6=토
    const r: Recurrence = { type: "weekly", weekdays: [1, 3, 5] };
    // 2026-06-01 은 월요일
    expect(occursOn(r, new Date(2026, 5, 1))).toBe(true); // 월
    expect(occursOn(r, new Date(2026, 5, 2))).toBe(false); // 화
    expect(occursOn(r, new Date(2026, 5, 3))).toBe(true); // 수
    expect(occursOn(r, new Date(2026, 5, 5))).toBe(true); // 금
    expect(occursOn(r, new Date(2026, 5, 6))).toBe(false); // 토
  });

  it("monthly 초: 1~10일 매일 발생", () => {
    const r: Recurrence = { type: "monthly", monthlyPart: "early" };
    expect(occursOn(r, new Date(2026, 5, 1))).toBe(true);
    expect(occursOn(r, new Date(2026, 5, 10))).toBe(true);
    expect(occursOn(r, new Date(2026, 5, 11))).toBe(false);
  });

  it("monthly 말: 21~월말 발생", () => {
    const r: Recurrence = { type: "monthly", monthlyPart: "late" };
    expect(occursOn(r, new Date(2026, 5, 20))).toBe(false);
    expect(occursOn(r, new Date(2026, 5, 21))).toBe(true);
    expect(occursOn(r, new Date(2026, 5, 30))).toBe(true);
  });
});

describe("timeOnDate", () => {
  it('"HH:mm" 을 해당 날짜의 epoch ms 로 변환', () => {
    const base = new Date(2026, 5, 15);
    const ts = timeOnDate(base, "09:30");
    expect(ts).not.toBeNull();
    const d = new Date(ts as number);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(30);
    expect(d.getFullYear()).toBe(2026);
  });

  it("잘못된 형식이면 null", () => {
    expect(timeOnDate(new Date(), "25:00")).toBeNull();
    expect(timeOnDate(new Date(), "9:99")).toBeNull();
    expect(timeOnDate(new Date(), "abc")).toBeNull();
  });
});
