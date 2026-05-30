import type { MonthlyPart, Recurrence, Weekday } from "./types.js";

/**
 * 월별 구분(초/중/말) 정의 — 기획 확정:
 *   초(early): 1–10일, 중(mid): 11–20일, 말(late): 21–월말
 */
export function monthlyPartForDay(dayOfMonth: number): MonthlyPart {
  if (dayOfMonth <= 10) return "early";
  if (dayOfMonth <= 20) return "mid";
  return "late";
}

/** Date → "YYYY-MM-DD" (로컬 기준; 현재 KST 운영 가정) */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 주어진 날짜에 해당 반복 규칙의 일정이 발생하는지 판정.
 *
 * - once   : recurrence.date 와 일치하는 날
 * - daily  : 매일
 * - weekly : 선택한 요일에 해당하는 날 (월~일 중 다중 선택)
 * - monthly: 선택한 구분(초/중/말) 범위에 속하는 날
 *            예) 초 선택 → 1~10일 매일 발생
 */
export function occursOn(recurrence: Recurrence, date: Date): boolean {
  switch (recurrence.type) {
    case "once":
      return recurrence.date === toDateKey(date);
    case "daily":
      return true;
    case "weekly": {
      const weekdays = recurrence.weekdays ?? [];
      return weekdays.includes(date.getDay() as Weekday);
    }
    case "monthly": {
      if (!recurrence.monthlyPart) return false;
      return monthlyPartForDay(date.getDate()) === recurrence.monthlyPart;
    }
    default:
      return false;
  }
}

/**
 * "HH:mm" 시각 문자열을 주어진 날짜에 적용해 epoch ms 로 변환.
 * 잘못된 형식이면 null.
 */
export function timeOnDate(date: Date, hhmm: string): number | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result.getTime();
}
