"use client";

import { type AlarmInstance, type Repositories, type Schedule } from "@routizen/core";
import { useCallback, useEffect, useState } from "react";

const STATE_LABEL: Record<string, string> = {
  SCHEDULED: "대기",
  STARTED: "진행 중",
  DONE: "완료 ✓",
  OVERDUE: "지남",
  FINAL_NOTIFIED: "마지막 알림",
  MISSED: "미실행",
};

// terminal 상태별 색상 — CSS 변수가 없으면 기본값 사용
const STATE_COLOR: Record<string, string> = {
  DONE: "#22c55e",
  MISSED: "#ef4444",
  OVERDUE: "#f59e0b",
  FINAL_NOTIFIED: "#f59e0b",
};

function formatDate(dateStr: string): string {
  // dateStr: "YYYY-MM-DD" — 로컬 자정 기준으로 파싱
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

interface Props {
  uid: string;
  repos: Repositories;
  scheduleMap: Map<string, Schedule>;
  today: string;
}

export function HistoryView({ uid, repos, scheduleMap, today }: Props) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AlarmInstance[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await repos.alarms.listRecent(uid, 60, today);
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [uid, repos, today]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="muted">불러오는 중…</p>;
  if (items.length === 0) return <p className="muted">아직 실행 기록이 없어요.</p>;

  // date DESC 순서로 날짜별 그룹화
  const byDate = new Map<string, AlarmInstance[]>();
  for (const item of items) {
    if (!byDate.has(item.date)) byDate.set(item.date, []);
    byDate.get(item.date)!.push(item);
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {[...byDate.entries()].map(([date, alarms]) => (
        <div key={date}>
          <div
            className="muted"
            style={{ fontSize: 12, marginBottom: 8, fontWeight: 600 }}
          >
            {formatDate(date)}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {alarms.map((a) => (
              <div key={a.id} className="row" style={{ justifyContent: "space-between" }}>
                <span>{scheduleMap.get(a.scheduleId)?.title ?? "삭제된 일정"}</span>
                <span
                  className="tag"
                  style={{ color: STATE_COLOR[a.state] ?? "inherit" }}
                >
                  {STATE_LABEL[a.state] ?? a.state}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
