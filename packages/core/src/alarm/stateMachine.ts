import type { AlarmStage, AlarmState } from "../types.js";

/**
 * 알람 상태 머신 (기획 2.3)
 *
 *   SCHEDULED ──START──▶ STARTED ──DONE──▶ DONE [종료]
 *        │                  │
 *        │                 END (미실행)
 *        │                  ▼
 *        │               OVERDUE ──FINAL──▶ FINAL_NOTIFIED ──EXPIRE──▶ MISSED [종료]
 *        │                  │                     │
 *        └──────────────────┴── DONE ────────────┴──▶ DONE
 *
 * 설계 원칙: **멱등(idempotent)**. Cloud Tasks 콜백이 중복 실행되거나
 * 사용자가 이미 "실행했음"을 누른 경우에도 안전하게 동작해야 한다.
 * 따라서 각 이벤트는 "현재 상태에서 의미 있을 때만" 전이/알림하고,
 * 그 외에는 상태를 바꾸지 않고 알림도 보내지 않는다(no-op).
 */

export type AlarmEvent =
  | "START" // 시작시간 도래
  | "END" // 끝시간 도래
  | "FINAL" // 끝시간 +1시간 (마지막 재알람)
  | "DONE" // 사용자가 "실행했음" 클릭
  | "EXPIRE"; // 일일 정리(cron): 당일 미완료 인스턴스를 MISSED 처리

export interface TransitionResult {
  /** 전이 후 상태 */
  next: AlarmState;
  /** 이번 전이로 실제 발송해야 하는 알림 단계 (없으면 null) */
  notify: AlarmStage | null;
  /** 상태가 실제로 바뀌었는지 (false면 no-op) */
  changed: boolean;
}

const TERMINAL: ReadonlySet<AlarmState> = new Set<AlarmState>(["DONE", "MISSED"]);

export function isTerminal(state: AlarmState): boolean {
  return TERMINAL.has(state);
}

export function canMarkDone(state: AlarmState): boolean {
  return !isTerminal(state);
}

/** 미실행으로 간주되는(아직 완료/종료되지 않은) 상태 */
function isPending(state: AlarmState): boolean {
  return state === "SCHEDULED" || state === "STARTED" || state === "OVERDUE";
}

/**
 * 순수 함수: 현재 상태 + 이벤트 → 다음 상태/알림 여부.
 * 부수효과 없음. 호출부(Cloud Function)가 결과의 notify 에 따라 실제 발송.
 */
export function transition(state: AlarmState, event: AlarmEvent): TransitionResult {
  const noop: TransitionResult = { next: state, notify: null, changed: false };

  switch (event) {
    case "START":
      if (state === "SCHEDULED") {
        return { next: "STARTED", notify: "start", changed: true };
      }
      return noop;

    case "END":
      // 시작 알람이 누락된 경우(SCHEDULED)도 끝 알람은 보낸다.
      if (state === "SCHEDULED" || state === "STARTED") {
        return { next: "OVERDUE", notify: "end", changed: true };
      }
      return noop;

    case "FINAL":
      // 마지막 재알람: 아직 미완료면 PUSH+EMAIL 발송.
      if (isPending(state)) {
        return { next: "FINAL_NOTIFIED", notify: "final", changed: true };
      }
      return noop;

    case "DONE":
      if (canMarkDone(state)) {
        return { next: "DONE", notify: null, changed: true };
      }
      return noop;

    case "EXPIRE":
      // 당일 마감 정리: 완료/종료되지 않은 모든 상태를 미실행 처리.
      if (!isTerminal(state)) {
        return { next: "MISSED", notify: null, changed: true };
      }
      return noop;

    default:
      return noop;
  }
}
