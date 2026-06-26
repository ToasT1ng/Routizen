"use client";

import {
  FREE_SCHEDULE_LIMIT,
  canCreateSchedule,
  remainingFreeSlots,
  toDateKey,
  type AlarmInstance,
  type AlarmStyle,
  type Recurrence,
  type Schedule,
} from "@routizen/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { startPremiumCheckout } from "@/lib/billing";
import { enablePush, isPushSupported, listenForegroundMessages } from "@/lib/messaging";
import { createFirebaseRepositories } from "@/lib/repositories.firebase";
import { ScheduleForm, type NewSchedule } from "./ScheduleForm";

type PushStatus =
  | "checking"
  | "unsupported"
  | "default"
  | "granted"
  | "denied"
  | "misconfigured"
  | "error";

const PUSH_MESSAGE: Record<Exclude<PushStatus, "checking">, string> = {
  unsupported: "이 브라우저는 푸시 알림을 지원하지 않아요 (iOS Safari는 홈 화면 추가 후 가능).",
  default: "알림을 켜면 시작·끝·마지막 알람을 푸시로 받을 수 있어요.",
  granted: "푸시 알림이 켜져 있어요 ✓",
  denied: "브라우저에서 알림이 차단됐어요. 사이트 설정에서 허용해 주세요.",
  // VAPID 키 미설정 — 재시도해도 안 되는 서버 설정 문제이므로 재시도 버튼을 띄우지 않는다.
  misconfigured: "푸시 알림이 아직 설정되지 않았어요. 잠시 후 지원될 예정이에요.",
  error: "알림 설정에 실패했어요. 잠시 후 다시 시도해 주세요.",
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function describeRecurrence(r: Recurrence): string {
  switch (r.type) {
    case "once":
      return `한 번 · ${r.date ?? ""}`;
    case "daily":
      return "매일";
    case "weekly":
      return `매주 ${(r.weekdays ?? []).map((d) => WEEKDAY_LABELS[d]).join("·")}`;
    case "monthly":
      return `매월 ${{ early: "초", mid: "중", late: "말" }[r.monthlyPart ?? "early"]}`;
    default:
      return "";
  }
}

const STATE_LABEL: Record<string, string> = {
  SCHEDULED: "대기",
  STARTED: "진행 중",
  DONE: "완료 ✓",
  OVERDUE: "지남",
  FINAL_NOTIFIED: "마지막 알림",
  MISSED: "미실행",
};

export function Dashboard() {
  const { profile, signOut, refreshProfile } = useAuth();
  const repos = useMemo(() => createFirebaseRepositories(), []);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [todayAlarms, setTodayAlarms] = useState<AlarmInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushStatus, setPushStatus] = useState<PushStatus>("checking");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [billingMsg, setBillingMsg] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // 폴링 콜백 안에서 최신 isPremium 을 읽기 위한 ref(stale closure 방지).
  const isPremiumRef = useRef(false);
  useEffect(() => {
    isPremiumRef.current = profile?.isPremium ?? false;
  }, [profile]);
  // isPremium 이 true 로 전환되면 결제 관련 billingMsg 를 자동으로 지운다.
  // 폴링 마지막 tick 의 타이밍 경쟁으로 오류 메시지가 남는 경우를 방지한다.
  useEffect(() => {
    if (profile?.isPremium) setBillingMsg(null);
  }, [profile?.isPremium]);

  const uid = profile?.uid;
  const today = useMemo(() => toDateKey(new Date()), []);

  const reload = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const [s, a] = await Promise.all([
        repos.schedules.listActive(uid),
        repos.alarms.listByDate(uid, today),
      ]);
      setSchedules(s);
      setTodayAlarms(a);
    } finally {
      setLoading(false);
    }
  }, [repos, uid, today]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // 푸시 지원/권한 상태 확인 + 포그라운드 메시지 리스너 등록(기획 3.2).
  useEffect(() => {
    let unsub: (() => void) | undefined;
    void (async () => {
      if (!(await isPushSupported())) {
        setPushStatus("unsupported");
        return;
      }
      setPushStatus(Notification.permission as PushStatus);
      unsub = await listenForegroundMessages();
    })();
    return () => unsub?.();
  }, []);

  const handleEnablePush = useCallback(async () => {
    if (!uid) return;
    const result = await enablePush(uid, repos);
    if (result.ok) {
      setPushStatus("granted");
      await refreshProfile();
    } else if (result.reason === "denied") {
      setPushStatus("denied");
    } else if (result.reason === "unsupported") {
      setPushStatus("unsupported");
    } else if (result.reason === "no-vapid") {
      // 서버 설정(VAPID) 문제 — 재시도 대상이 아님(아래 misconfigured 메시지).
      setPushStatus("misconfigured");
    } else {
      // 일시적 오류 — 사용자에게 실패를 노출하고 재시도 허용(이전엔 무반응)
      setPushStatus("error");
    }
  }, [uid, repos, refreshProfile]);

  // 외부 브라우저 Checkout 복귀 감지용 포커스 핸들러 참조(정리 시 사용).
  const externalFocusHandlerRef = useRef<(() => void) | null>(null);

  // Stripe Checkout 시작.
  // 브라우저: Stripe 로 리다이렉트 → 이후 반환 없음.
  // Tauri 맥앱: 기본 브라우저로 열고 "external" 반환 → 앱 포커스 복귀 시 프리미엄 상태 폴링.
  const handleUpgrade = useCallback(async () => {
    setCheckoutBusy(true);
    setBillingMsg(null);
    const result = await startPremiumCheckout();

    if (result === "external") {
      // 기본 브라우저로 Checkout 이 열렸음.
      // checkoutBusy 는 true 유지 → 앱 포커스 복귀 전까지 버튼 비활성(이중 클릭 방지).
      setBillingMsg("기본 브라우저에서 결제를 완료한 뒤 이 앱으로 돌아오세요.");
      // 혹시 이전 핸들러가 남아 있으면 선제 제거.
      const existing = externalFocusHandlerRef.current;
      if (existing) window.removeEventListener("focus", existing);
      const handler = () => {
        externalFocusHandlerRef.current = null;
        window.removeEventListener("focus", handler);
        setCheckoutBusy(false);
        setBillingMsg("결제 완료 여부를 확인하는 중…");
        let tries = 0;
        const timer = setInterval(() => {
          tries += 1;
          void refreshProfile().catch(() => {}).then(() => {
            if (tries >= 5 || isPremiumRef.current) {
              clearInterval(timer);
              setBillingMsg(
                isPremiumRef.current
                  ? null
                  : "결제가 아직 반영되지 않았어요. 잠시 후 앱을 재시작해 다시 확인해 주세요.",
              );
            }
          });
        }, 2000);
      };
      externalFocusHandlerRef.current = handler;
      window.addEventListener("focus", handler);
      return;
    }

    if (result) {
      setCheckoutBusy(false);
      setBillingMsg(
        result === "already-premium"
          ? "이미 프리미엄 구독 중이에요."
          : result === "not-configured"
            ? "결제가 아직 준비되지 않았어요. 잠시 후 다시 시도해 주세요."
            : "결제 시작에 실패했어요. 잠시 후 다시 시도해 주세요.",
      );
      // 서버는 활성 구독이라 거절했는데 로컬 isPremium 이 stale 일 수 있으므로 동기화.
      if (result === "already-premium") await refreshProfile().catch(() => {});
    }
  }, [refreshProfile]);

  // 언마운트 시 외부 Checkout 포커스 리스너를 정리한다(방어적).
  useEffect(() => {
    return () => {
      const handler = externalFocusHandlerRef.current;
      if (handler) window.removeEventListener("focus", handler);
    };
  }, []);

  // Tauri 딥링크 이벤트 리스너 — routizen://checkout/success 수신 시 포커스 폴링을 취소하고
  // 프로필을 즉시 갱신한다. 포커스 폴링보다 빠르고 신뢰도 높은 경로.
  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
    let mounted = true;
    let unlisten: (() => void) | undefined;
    void (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      if (!mounted) return;
      unlisten = await listen("checkout-complete", () => {
        const handler = externalFocusHandlerRef.current;
        if (handler) {
          window.removeEventListener("focus", handler);
          externalFocusHandlerRef.current = null;
        }
        setCheckoutBusy(false);
        setBillingMsg("결제 완료 여부를 확인하는 중…");
        // 웹훅이 아직 처리 중일 수 있으므로 2초 간격 3회 재시도.
        let tries = 0;
        const timer = setInterval(() => {
          tries += 1;
          void refreshProfile().catch(() => {}).then(() => {
            if (tries >= 3 || isPremiumRef.current) clearInterval(timer);
          });
        }, 2000);
      });
    })();
    return () => {
      mounted = false;
      unlisten?.();
    };
  }, [refreshProfile]);

  // Checkout 복귀 처리(?checkout=success|cancel). isPremium 은 웹훅이 비동기로 갱신하므로
  // 성공 시 잠시 폴링하며 프로필을 새로고침한다. URL 파라미터는 즉시 정리(반복 표시 방지).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    if (!checkout) return;
    window.history.replaceState({}, "", window.location.pathname);
    if (checkout === "cancel") {
      setBillingMsg("결제가 취소됐어요.");
      return;
    }
    if (checkout === "success") {
      setBillingMsg("결제가 완료됐어요! 프리미엄 적용까지 잠시 걸릴 수 있어요.");
      // Tauri 앱이 설치돼 있으면 딥링크로 즉시 신호 전달.
      // window.open 사용 — location.href 는 현재 페이지를 이동시켜 폴링을 소멸시킴.
      window.open("routizen://checkout/success", "_blank");
      // 폴링(딥링크 미지원 환경 폴백 — 웹 브라우저 또는 딥링크 실패 시).
      let tries = 0;
      const timer = setInterval(() => {
        tries += 1;
        void refreshProfile().catch(() => {}).then(() => {
          if (tries >= 5 || isPremiumRef.current) clearInterval(timer);
        });
      }, 2000);
      return () => clearInterval(timer);
    }
  }, [refreshProfile]);

  if (!profile) return null;

  const activeCount = schedules.length;
  const canCreate = canCreateSchedule(profile.isPremium, activeCount);
  const remaining = remainingFreeSlots(profile, activeCount);
  // editingId 가 가리키는 일정이 목록에서 사라졌을 때(리로드 타이밍 등) null 로 폴백.
  const editingSchedule = editingId ? (schedules.find((s) => s.id === editingId) ?? null) : null;

  const handleCreate = async (input: NewSchedule): Promise<boolean> => {
    try {
      await repos.schedules.create({ ...input, uid: profile.uid });
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "permission-denied" && input.extraAlarms.length > 0) {
        // 추가 알람 슬롯 포함 저장이 거부됨 — 로컬 isPremium 이 서버와 어긋났을 가능성이 높으므로 동기화.
        // best-effort: 동기화 자체가 실패해도 사용자에게는 아래 안내 메시지를 보여준다.
        await refreshProfile().catch(() => {});
        setScheduleError(
          "추가 알람 슬롯을 포함해 저장하지 못했어요. 프리미엄 상태를 다시 확인한 뒤 다시 시도해 주세요.",
        );
      } else {
        setScheduleError("일정 등록에 실패했어요. 잠시 후 다시 시도해 주세요.");
      }
      return false;
    }
    // 저장은 성공 — 목록 새로고침이 실패해도 저장 자체는 성공으로 처리한다.
    setScheduleError(null);
    await reload().catch(() => {});
    return true;
  };

  const handleUpdate = async (id: string, patch: NewSchedule): Promise<boolean> => {
    try {
      await repos.schedules.update(id, patch);
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "permission-denied" && patch.extraAlarms.length > 0) {
        await refreshProfile().catch(() => {});
        setScheduleError(
          "추가 알람 슬롯을 포함해 저장하지 못했어요. 프리미엄 상태를 다시 확인한 뒤 다시 시도해 주세요.",
        );
      } else {
        setScheduleError("일정 수정에 실패했어요. 잠시 후 다시 시도해 주세요.");
      }
      return false;
    }
    setScheduleError(null);
    setEditingId(null);
    await reload().catch(() => {});
    return true;
  };

  const handleDelete = async (id: string) => {
    if (editingId === id) setEditingId(null);
    await repos.schedules.remove(id);
    await reload();
  };

  const handleStyleChange = async (style: AlarmStyle) => {
    await repos.users.setAlarmStyle(profile.uid, style);
    await refreshProfile();
  };

  const handleMarkDone = async (id: string) => {
    await repos.alarms.markDone(id);
    await reload();
  };

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1>안녕하세요, {profile.displayName ?? "루티즌"}님</h1>
          <span className="muted">
            {profile.isPremium ? "프리미엄" : `무료 · 남은 일정 ${remaining}개`}
          </span>
        </div>
        <button className="btn-ghost" onClick={() => void signOut()}>
          로그아웃
        </button>
      </div>

      {/* 알람 스타일 (사용자 전역 설정 — 기획 2.4) */}
      <div className="card">
        <h2>알람 스타일</h2>
        <div className="row">
          {(["normal", "push"] as AlarmStyle[]).map((style) => (
            <button
              key={style}
              className={profile.alarmStyle === style ? "btn" : "btn-ghost"}
              onClick={() => void handleStyleChange(style)}
            >
              {style === "normal" ? "보통 (부드럽게)" : "압박 (강하게)"}
            </button>
          ))}
        </div>
      </div>

      {/* 푸시 알림 (FCM 웹 푸시 — 기획 2.5 / 3.2) */}
      <div className="card">
        <h2>알림</h2>
        {pushStatus === "checking" ? (
          <p className="muted">확인 중…</p>
        ) : (
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted">{PUSH_MESSAGE[pushStatus]}</span>
            {(pushStatus === "default" || pushStatus === "error") && (
              <button className="btn" onClick={() => void handleEnablePush()}>
                {pushStatus === "error" ? "다시 시도" : "알림 켜기"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 프리미엄 구독 (Stripe — 기획 3.5) */}
      <div className={`card${!profile.isPremium && !canCreate ? " card--alert" : ""}`}>
        <h2>프리미엄</h2>
        {profile.isPremium ? (
          <p className="muted">
            프리미엄 이용 중이에요 ✓
            {profile.subscription?.currentPeriodEnd
              ? ` · 다음 결제 ${new Date(
                  profile.subscription.currentPeriodEnd,
                ).toLocaleDateString("ko-KR")}`
              : ""}
          </p>
        ) : (
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted">일정 무제한 · 사용자 지정 추가 알람 슬롯을 풀 수 있어요.</span>
            <button className="btn" disabled={checkoutBusy} onClick={() => void handleUpgrade()}>
              {checkoutBusy ? "이동 중…" : "업그레이드"}
            </button>
          </div>
        )}
        {billingMsg && (
          <p className="muted" style={{ marginTop: 8 }}>
            {billingMsg}
          </p>
        )}
      </div>

      {/* 오늘의 알람 */}
      <div className="card">
        <h2>오늘의 루틴 ({today})</h2>
        {loading ? (
          <p className="muted">불러오는 중…</p>
        ) : todayAlarms.length === 0 ? (
          <p className="muted">오늘 예정된 알람 인스턴스가 아직 없어요.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {todayAlarms.map((a) => (
              <div key={a.id} className="row" style={{ justifyContent: "space-between" }}>
                <div className="row">
                  <span className="tag">{STATE_LABEL[a.state] ?? a.state}</span>
                  <span>{schedules.find((s) => s.id === a.scheduleId)?.title ?? a.scheduleId}</span>
                </div>
                {a.state !== "DONE" && a.state !== "MISSED" && (
                  <button className="btn btn-done" onClick={() => void handleMarkDone(a.id)}>
                    실행했음
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 일정 목록 */}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>내 일정</h2>
          {!profile.isPremium && (
            <span className="muted" style={{ fontSize: 12 }}>
              {activeCount} / {FREE_SCHEDULE_LIMIT}
            </span>
          )}
        </div>
        {!profile.isPremium && (
          <div className="slot-bar">
            <div
              className={`slot-bar-fill${remaining === 0 ? " slot-bar-fill--warn" : ""}`}
              style={{ width: `${Math.min((activeCount / FREE_SCHEDULE_LIMIT) * 100, 100)}%` }}
            />
          </div>
        )}
        {schedules.length === 0 ? (
          <p className="muted">아직 등록한 일정이 없어요.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {schedules.map((s) => (
              <div key={s.id} className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <div>{s.title}</div>
                  <span className="muted">
                    {describeRecurrence(s.recurrence)} · {s.startTime}–{s.endTime}
                  </span>
                </div>
                <div className="row">
                  <button
                    className={editingId === s.id ? "btn" : "btn-ghost"}
                    onClick={() => {
                      setScheduleError(null);
                      setEditingId((prev) => (prev === s.id ? null : s.id));
                    }}
                  >
                    편집
                  </button>
                  <button className="btn-ghost" onClick={() => void handleDelete(s.id)}>
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingSchedule ? (
        <ScheduleForm
          key={editingSchedule.id}
          isPremium={profile.isPremium}
          disabled={false}
          error={scheduleError}
          initialSchedule={editingSchedule}
          onUpdate={(patch) => handleUpdate(editingSchedule.id, patch)}
          onCancel={() => { setEditingId(null); setScheduleError(null); }}
          onUpgrade={profile.isPremium ? undefined : () => void handleUpgrade()}
        />
      ) : (
        <ScheduleForm
          key="new"
          isPremium={profile.isPremium}
          disabled={!canCreate}
          error={scheduleError}
          onCreate={handleCreate}
          onUpgrade={profile.isPremium ? undefined : () => void handleUpgrade()}
        />
      )}
    </div>
  );
}
