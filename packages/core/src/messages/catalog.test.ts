import { describe, expect, it } from "vitest";
import { MESSAGE_CATALOG, pickMessage } from "./catalog.js";

describe("MESSAGE_CATALOG", () => {
  it("각 스타일/단계마다 10개씩 문구 보유", () => {
    for (const style of ["normal", "push"] as const) {
      for (const stage of ["start", "end", "final"] as const) {
        expect(MESSAGE_CATALOG[style][stage]).toHaveLength(10);
      }
    }
  });
});

describe("pickMessage", () => {
  it("{title} 를 일정명으로 치환", () => {
    const msg = pickMessage("normal", "start", "아침 운동", () => 0);
    expect(msg).toContain("아침 운동");
    expect(msg).not.toContain("{title}");
  });

  it("rng 로 결정적 선택 (rng=0 → 첫 번째)", () => {
    const msg = pickMessage("push", "final", "독서", () => 0);
    expect(msg).toBe(
      "진짜 마지막 경고예요!! 독서 안 하면 루틴 깨져요!!!! (메일 확인 必)",
    );
  });

  it("rng≈1 이어도 인덱스가 범위를 벗어나지 않음", () => {
    const msg = pickMessage("normal", "end", "스트레칭", () => 0.999999);
    expect(msg).toContain("스트레칭");
    expect(msg).not.toContain("{title}");
  });

  it('extra 단계는 start 풀을 재사용', () => {
    const extra = pickMessage("normal", "extra", "물 마시기", () => 0);
    const start = pickMessage("normal", "start", "물 마시기", () => 0);
    expect(extra).toBe(start);
  });
});
