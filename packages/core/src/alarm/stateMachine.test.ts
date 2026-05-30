import { describe, expect, it } from "vitest";
import type { AlarmState } from "../types.js";
import { canMarkDone, isTerminal, transition } from "./stateMachine.js";

describe("transition — 정상 흐름", () => {
  it("SCHEDULED + START → STARTED, 시작 알림", () => {
    const r = transition("SCHEDULED", "START");
    expect(r).toEqual({ next: "STARTED", notify: "start", changed: true });
  });

  it("STARTED + END → OVERDUE, 끝 알림", () => {
    const r = transition("STARTED", "END");
    expect(r).toEqual({ next: "OVERDUE", notify: "end", changed: true });
  });

  it("OVERDUE + FINAL → FINAL_NOTIFIED, 마지막 알림(PUSH+EMAIL)", () => {
    const r = transition("OVERDUE", "FINAL");
    expect(r).toEqual({ next: "FINAL_NOTIFIED", notify: "final", changed: true });
  });

  it("FINAL_NOTIFIED + EXPIRE → MISSED, 알림 없음", () => {
    const r = transition("FINAL_NOTIFIED", "EXPIRE");
    expect(r).toEqual({ next: "MISSED", notify: null, changed: true });
  });
});

describe('transition — "실행했음"(DONE) 은 어느 단계서든 알람을 끈다', () => {
  const pendingStates: AlarmState[] = ["SCHEDULED", "STARTED", "OVERDUE", "FINAL_NOTIFIED"];
  for (const state of pendingStates) {
    it(`${state} + DONE → DONE`, () => {
      const r = transition(state, "DONE");
      expect(r).toEqual({ next: "DONE", notify: null, changed: true });
    });
  }

  it("DONE 이후 END/FINAL 태스크가 늦게 실행돼도 알림 없음(no-op)", () => {
    expect(transition("DONE", "END")).toEqual({ next: "DONE", notify: null, changed: false });
    expect(transition("DONE", "FINAL")).toEqual({ next: "DONE", notify: null, changed: false });
    expect(transition("DONE", "START")).toEqual({ next: "DONE", notify: null, changed: false });
  });
});

describe("transition — 멱등성(중복 실행 안전)", () => {
  it("START 두 번 → 두 번째는 no-op", () => {
    const first = transition("SCHEDULED", "START");
    const second = transition(first.next, "START");
    expect(second).toEqual({ next: "STARTED", notify: null, changed: false });
  });

  it("END 두 번 → 두 번째는 no-op", () => {
    const second = transition("OVERDUE", "END");
    expect(second.changed).toBe(false);
    expect(second.notify).toBeNull();
  });

  it("FINAL 두 번 → 두 번째는 no-op", () => {
    const second = transition("FINAL_NOTIFIED", "FINAL");
    expect(second.changed).toBe(false);
    expect(second.notify).toBeNull();
  });
});

describe("transition — 엣지 케이스", () => {
  it("시작 알람 누락 시 SCHEDULED + END 도 끝 알림 발송", () => {
    expect(transition("SCHEDULED", "END")).toEqual({
      next: "OVERDUE",
      notify: "end",
      changed: true,
    });
  });

  it("STARTED 상태에서 FINAL 이 와도 마지막 알림 발송", () => {
    expect(transition("STARTED", "FINAL")).toEqual({
      next: "FINAL_NOTIFIED",
      notify: "final",
      changed: true,
    });
  });

  it("MISSED 는 종료 상태 — DONE/EXPIRE 모두 no-op", () => {
    expect(transition("MISSED", "DONE")).toEqual({ next: "MISSED", notify: null, changed: false });
    expect(transition("MISSED", "EXPIRE")).toEqual({
      next: "MISSED",
      notify: null,
      changed: false,
    });
  });

  it("EXPIRE 는 미완료 상태를 MISSED 로 정리", () => {
    expect(transition("OVERDUE", "EXPIRE").next).toBe("MISSED");
    expect(transition("STARTED", "EXPIRE").next).toBe("MISSED");
    expect(transition("SCHEDULED", "EXPIRE").next).toBe("MISSED");
  });
});

describe("isTerminal / canMarkDone", () => {
  it("DONE, MISSED 만 종료 상태", () => {
    expect(isTerminal("DONE")).toBe(true);
    expect(isTerminal("MISSED")).toBe(true);
    expect(isTerminal("SCHEDULED")).toBe(false);
    expect(isTerminal("OVERDUE")).toBe(false);
  });

  it("종료 상태가 아니면 실행했음 가능", () => {
    expect(canMarkDone("OVERDUE")).toBe(true);
    expect(canMarkDone("DONE")).toBe(false);
    expect(canMarkDone("MISSED")).toBe(false);
  });
});
