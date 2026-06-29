"use client";

import { type AlarmInstance, type Repositories, type Schedule } from "@routizen/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { STATE_COLOR, getStateLabel } from "@/lib/alarmLabels";

function formatDate(dateStr: string): string {
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
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await repos.alarms.listRecent(uid, 60, today);
      setItems(data);
    } catch {
      setError("기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }, [uid, repos, today]);

  useEffect(() => {
    void load();
  }, [load]);

  // items는 Firestore orderBy(date DESC)로 반환되므로 Map 삽입 순서가 곧 날짜 내림차순
  const byDate = useMemo(() => {
    const map = new Map<string, AlarmInstance[]>();
    for (const item of items) {
      if (!map.has(item.date)) map.set(item.date, []);
      map.get(item.date)!.push(item);
    }
    return map;
  }, [items]);

  if (loading) return <p className="muted">불러오는 중…</p>;
  if (error) return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <p className="muted" style={{ margin: 0 }}>{error}</p>
      <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => void load()}>
        다시 시도
      </button>
    </div>
  );
  if (items.length === 0) return <p className="muted">아직 실행 기록이 없어요.</p>;

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
                  {getStateLabel(a.state)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
