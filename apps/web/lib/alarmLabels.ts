import type { AlarmState } from "@routizen/core";

export const STATE_LABEL: Record<AlarmState, string> = {
  SCHEDULED: "대기",
  STARTED: "진행 중",
  DONE: "완료 ✓",
  OVERDUE: "지남",
  FINAL_NOTIFIED: "마지막 알림",
  MISSED: "미실행",
};

export const STATE_COLOR: Partial<Record<AlarmState, string>> = {
  DONE: "#22c55e",
  MISSED: "#ef4444",
  OVERDUE: "#f59e0b",
  FINAL_NOTIFIED: "#f59e0b",
};

// Firestore 데이터는 런타임에 임의 string이 올 수 있으므로 unknown state에 대한 fallback 포함
export function getStateLabel(state: string): string {
  return (STATE_LABEL as Record<string, string | undefined>)[state] ?? state;
}
