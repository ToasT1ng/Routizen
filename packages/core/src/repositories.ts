import type { AlarmInstance, AlarmStyle, FcmTokenEntry, Schedule, User } from "./types.js";

/**
 * 데이터 접근 추상화 (기획 3.1)
 * 컴포넌트는 이 인터페이스에만 의존하고, 구현체(Firebase 등)는 주입받는다.
 * → 향후 백엔드 교체 시 이 레이어만 갈아끼우면 됨.
 */

export interface UserRepository {
  get(uid: string): Promise<User | null>;
  /** 최초 로그인 시 사용자 문서 생성(이미 있으면 그대로 반환) */
  ensure(user: Pick<User, "uid" | "email" | "displayName" | "photoURL">): Promise<User>;
  setAlarmStyle(uid: string, style: AlarmStyle): Promise<void>;
  /**
   * FCM 토큰 등록(업서트). 같은 token 의 기존 항목은 교체하고 updatedAt 을 갱신한다.
   * 단계별 알람 발송 시 user.fcmTokens 로 멀티캐스트되므로(notify.ts) 필수.
   */
  addFcmToken(uid: string, entry: FcmTokenEntry): Promise<void>;
}

export interface ScheduleRepository {
  listActive(uid: string): Promise<Schedule[]>;
  countActive(uid: string): Promise<number>;
  create(input: Omit<Schedule, "id">): Promise<Schedule>;
  update(id: string, patch: Partial<Omit<Schedule, "id" | "uid">>): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface AlarmInstanceRepository {
  /** 특정 날짜(YYYY-MM-DD)의 사용자 알람 인스턴스 */
  listByDate(uid: string, date: string): Promise<AlarmInstance[]>;
  /** "실행했음" — 완료 처리 */
  markDone(id: string): Promise<void>;
}

export interface Repositories {
  users: UserRepository;
  schedules: ScheduleRepository;
  alarms: AlarmInstanceRepository;
}
