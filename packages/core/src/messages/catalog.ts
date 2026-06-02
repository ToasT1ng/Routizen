import type { AlarmStage, AlarmStyle } from "../types.js";

/**
 * 알림 메시지 카탈로그 (기획 5장)
 * 단계(start/end/final) × 스타일(normal/push) 별 문구 풀.
 * `{title}` 는 일정명으로 치환된다. 단계별로 풀에서 무작위 1개 선택.
 *
 * 추후 다국어(i18n) 대비: 현재는 ko 단일. 언어 키를 한 단계 더
 * 감싸는 형태로 확장 가능하도록 구조만 단순하게 유지.
 */

type StageMessages = Record<"start" | "end" | "final", string[]>;

export const MESSAGE_CATALOG: Record<AlarmStyle, StageMessages> = {
  // 보통: 부드러운 격려 톤
  normal: {
    start: [
      "저와 함께 루틴을 지켜봐요 🙂 {title} 시작할 시간이에요.",
      "{title} 시작할 시간이 됐어요. 가볍게 시작해볼까요?",
      "오늘도 한 걸음! {title} 함께 해봐요.",
      "{title} 시간이에요. 준비되셨나요? 😊",
      "작은 실천이 루틴이 돼요. {title} 시작해요.",
      "지금이 딱 좋은 타이밍이에요 — {title} 가요!",
      "{title}, 부담 갖지 말고 시작만 해봐요.",
      "루틴 친구가 알려드려요: {title} 시작 시간이에요 🌱",
      "오늘의 {title}, 지금 시작하면 기분 좋게 끝낼 수 있어요.",
      "{title} 할 시간! 천천히 시작해도 괜찮아요.",
    ],
    end: [
      "{title} 아직이신가요? 천천히라도 시작해봐요.",
      "끝시간이 지났어요. {title} 지금이라도 괜찮아요 🙂",
      "{title} 못 하셨군요. 늦지 않았어요, 해볼까요?",
      "괜찮아요, 지금 {title} 하면 돼요. 응원할게요!",
      "{title} 마무리 시간이에요. 지금이라도 한 번?",
      "조금 늦었지만 {title}, 아직 할 수 있어요.",
      "{title} 잊으신 건 아니죠? 지금 해봐요 😊",
      "오늘의 {title}, 아직 기회가 있어요.",
      "{title} 끝시간이 지났어요. 가볍게라도 시작해요.",
      "지금 {title} 하면 오늘 하루 뿌듯하게 마무리돼요.",
    ],
    final: [
      "{title}, 마지막으로 알려드려요. 오늘 꼭 해봐요 🙏 (메일도 보냈어요)",
      "오늘의 {title} 마지막 알림이에요. 지금이라도 해볼까요?",
      "{title} 한 번만 더 챙겨드려요. 할 수 있어요! (이메일 확인)",
      "마지막 응원이에요 — {title}, 오늘 안에 해봐요 🌷",
      "{title} 못 하면 아쉬우니까, 마지막으로 알려드려요.",
      "오늘 {title}의 마지막 기회예요. 가볍게라도! (메일 발송)",
      "{title}, 끝까지 응원할게요. 지금 해봐요 🙂",
      "마지막 알림: {title} 아직 늦지 않았어요. (이메일도 보냈어요)",
      "{title} 오늘 마무리, 지금이 정말 마지막이에요.",
      "한 번만 더! {title} 하고 뿌듯하게 자요 🌙 (메일 확인)",
    ],
  },
  // 압박: 강하게 압박하는 톤
  push: {
    start: [
      "{title}, 지금 시작해야죠! 미루지 마세요 💢",
      "또 미룰 거예요? {title} 당장 시작!!",
      "시간 됐어요!! {title} 안 할 거예요?? 🔥",
      "{title} 시작 시간입니다. 변명 금지!",
      "지금 안 하면 또 후회해요. {title} 시작!!",
      "루틴 지키신다면서요? {title} 당장 가시죠.",
      "{title}!! 폰 그만 보고 시작하세요!!",
      "어허, {title} 시간이에요. 바로 움직이세요.",
      "오늘도 미루면 내일도 미뤄요. {title} 시작!!",
      "{title} 시작 안 하면 알람 계속 갑니다 😤",
    ],
    end: [
      "저기요???? {title} 끝시간 지났어요!!!",
      "{title} 아직도 안 했어요?? 진짜요??",
      "끝났는데요?? {title} 도대체 언제 할 거예요!",
      "{title} 미루기 챔피언이세요? 지금 당장!!",
      "끝시간 지났습니다!! {title} 안 하실 거예요?? 😡",
      "이러다 또 못 해요. {title} 지금 하세요!!",
      "{title}!! 끝났는데 손도 안 댔죠??",
      "루틴 깨지기 직전이에요. {title} 빨리!!",
      "{title} 끝시간 초과!! 더는 안 봐줘요.",
      "지금 {title} 안 하면 곧 마지막 경고 갑니다 ⏰",
    ],
    final: [
      "진짜 마지막 경고예요!! {title} 안 하면 루틴 깨져요!!!! (메일 확인 必)",
      "{title} 마지막입니다!! 지금 안 하면 끝이에요!!",
      "더는 안 알려줘요. {title} 당장 하세요!! (이메일도 갔어요)",
      "{title}!!! 오늘 마지막 기회!! 미루면 끝!!",
      "마지막 알림!! {title} 안 하면 오늘 실패 처리됩니다.",
      "이게 진짜 끝이에요. {title} 지금 안 하면 몰라요!! (메일 確認)",
      "{title} 마지막 경고!! 더 이상의 자비는 없습니다 😤",
      "지금 {title} 안 하면 오늘 루틴 깨진 거예요!! (이메일 발송)",
      "마지막입니다!! {title}!! 폰 든 김에 바로 하세요!!",
      "{title} 최후통첩!! 지금 안 하면 미실행으로 기록돼요!! (메일 확인)",
    ],
  },
};

/** "extra"(프리미엄 추가 슬롯) 단계는 start 풀을 재사용한다. */
function poolFor(style: AlarmStyle, stage: AlarmStage): string[] {
  const stageKey = stage === "extra" ? "start" : stage;
  return MESSAGE_CATALOG[style][stageKey];
}

/**
 * 스타일/단계에 맞는 문구를 무작위로 골라 `{title}` 치환 후 반환.
 * @param rng 0~1 난수 생성기(테스트 주입용). 기본값 Math.random.
 */
export function pickMessage(
  style: AlarmStyle,
  stage: AlarmStage,
  title: string,
  rng: () => number = Math.random,
): string {
  const pool = poolFor(style, stage);
  const index = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  const template = pool[index] ?? pool[0] ?? "{title}";
  return template.replaceAll("{title}", title);
}
