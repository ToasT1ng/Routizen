"use client";

import {
  canCreateSchedule,
  remainingFreeSlots,
  toDateKey,
  type AlarmInstance,
  type AlarmStyle,
  type Recurrence,
  type Schedule,
} from "@routizen/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { enablePush, isPushSupported, listenForegroundMessages } from "@/lib/messaging";
import { createFirebaseRepositories } from "@/lib/repositories.firebase";
import { ScheduleForm, type NewSchedule } from "./ScheduleForm";

type PushStatus = "checking" | "unsupported" | "default" | "granted" | "denied";

const PUSH_MESSAGE: Record<Exclude<PushStatus, "checking">, string> = {
  unsupported: "이 브라우저는 푸시 알림을 지원하지 않아요 (iOS Safari는 홈 화면 추가 후 가능).",
  default: "알림을 켜면 시작·끝·마지막 알람을 푸시로 받을 수 있어요.",
  granted: "푸시 알림이 켜져 있어요 ✓",
  denied: "브라우저에서 알림이 차단됐어요. 사이트 설정에서 허용해 주세요.",
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
    }
  }, [uid, repos, refreshProfile]);

  if (!profile) return null;

  const activeCount = schedules.length;
  const canCreate = canCreateSchedule(profile.isPremium, activeCount);
  const remaining = remainingFreeSlots(profile, activeCount);

  const handleCreate = async (input: NewSchedule) => {
    await repos.schedules.create({ ...input, uid: profile.uid });
    await reload();
  };

  const handleDelete = async (id: string) => {
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
            {pushStatus === "default" && (
              <button className="btn" onClick={() => void handleEnablePush()}>
                알림 켜기
              </button>
            )}
          </div>
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
        <h2>내 일정 ({activeCount})</h2>
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
                <button className="btn-ghost" onClick={() => void handleDelete(s.id)}>
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ScheduleForm isPremium={profile.isPremium} disabled={!canCreate} onCreate={handleCreate} />
    </div>
  );
}
