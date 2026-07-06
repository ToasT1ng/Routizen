"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  occursOn,
  toDateKey,
  type AlarmInstance,
  type Repositories,
  type Schedule,
} from "@routizen/core";
import { getStateLabel, STATE_COLOR } from "@/lib/alarmLabels";

type ViewMode = "month" | "week" | "day";

const DOW_SHORT = ["일", "월", "화", "수", "목", "금", "토"];

function parseDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function getMonthDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days: Date[] = [];
  for (let i = 0; i < first.getDay(); i++) {
    days.push(new Date(year, month, 1 - first.getDay() + i));
  }
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  const rem = days.length % 7;
  if (rem !== 0) {
    for (let i = 1; i <= 7 - rem; i++) {
      days.push(new Date(year, month + 1, i));
    }
  }
  return days;
}

function getWeekDays(anchor: Date): Date[] {
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - anchor.getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

interface Props {
  uid: string;
  repos: Repositories;
  schedules: Schedule[];
  scheduleMap: Map<string, Schedule>;
  today: string;
  onMarkDone: (id: string) => Promise<void>;
}

export function CalendarView({ uid, repos, schedules, scheduleMap, today, onMarkDone }: Props) {
  const [mode, setMode] = useState<ViewMode>("month");
  const [selectedDate, setSelectedDate] = useState(today);
  const selectedObj = useMemo(() => parseDate(selectedDate), [selectedDate]);
  const [viewYear, setViewYear] = useState(selectedObj.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedObj.getMonth());
  const [alarms, setAlarms] = useState<AlarmInstance[]>([]);
  const [loadingAlarms, setLoadingAlarms] = useState(false);

  const fetchAlarms = useCallback(
    async (date: string) => {
      setLoadingAlarms(true);
      try {
        setAlarms(await repos.alarms.listByDate(uid, date));
      } finally {
        setLoadingAlarms(false);
      }
    },
    [repos, uid],
  );

  useEffect(() => {
    void fetchAlarms(selectedDate);
  }, [fetchAlarms, selectedDate]);

  const handleMarkDone = useCallback(
    async (id: string) => {
      await onMarkDone(id);
      await fetchAlarms(selectedDate);
    },
    [onMarkDone, fetchAlarms, selectedDate],
  );

  const schedulesOn = useCallback(
    (date: Date) => schedules.filter((s) => s.active && occursOn(s.recurrence, date)),
    [schedules],
  );

  const selectDate = useCallback((date: Date) => {
    setSelectedDate(toDateKey(date));
    setViewYear(date.getFullYear());
    setViewMonth(date.getMonth());
    setMode("day");
  }, []);

  const prevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) { setViewYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }, []);
  const nextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) { setViewYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }, []);

  const weekDays = useMemo(() => getWeekDays(selectedObj), [selectedObj]);
  const prevWeek = useCallback(() => setSelectedDate(toDateKey(addDays(selectedObj, -7))), [selectedObj]);
  const nextWeek = useCallback(() => setSelectedDate(toDateKey(addDays(selectedObj, 7))), [selectedObj]);
  const prevDay = useCallback(() => setSelectedDate(toDateKey(addDays(selectedObj, -1))), [selectedObj]);
  const nextDay = useCallback(() => setSelectedDate(toDateKey(addDays(selectedObj, 1))), [selectedObj]);

  const monthDays = useMemo(() => getMonthDays(viewYear, viewMonth), [viewYear, viewMonth]);

  const dowColor = (dow: number, isSelected: boolean) => {
    if (isSelected) return "#fff";
    if (dow === 0) return "var(--danger)";
    if (dow === 6) return "var(--accent)";
    return "var(--text)";
  };

  return (
    <div className="card">
      {/* 뷰 모드 탭 */}
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>캘린더</h2>
        <div className="row" style={{ gap: 4 }}>
          {(["month", "week", "day"] as ViewMode[]).map((m) => (
            <button
              key={m}
              className={mode === m ? "btn" : "btn-ghost"}
              style={{ padding: "5px 12px", fontSize: 12 }}
              onClick={() => setMode(m)}
            >
              {m === "month" ? "월" : m === "week" ? "주" : "일"}
            </button>
          ))}
        </div>
      </div>

      {/* 월 뷰 */}
      {mode === "month" && (
        <>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
            <button className="btn-ghost" style={{ padding: "4px 12px", fontSize: 16 }} onClick={prevMonth}>
              ‹
            </button>
            <span style={{ fontWeight: 600, fontSize: 15 }}>
              {viewYear}년 {viewMonth + 1}월
            </span>
            <button className="btn-ghost" style={{ padding: "4px 12px", fontSize: 16 }} onClick={nextMonth}>
              ›
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
            {DOW_SHORT.map((label, i) => (
              <div
                key={label}
                style={{
                  textAlign: "center",
                  fontSize: 11,
                  padding: "4px 0",
                  color: i === 0 ? "var(--danger)" : i === 6 ? "var(--accent)" : "var(--text-dim)",
                }}
              >
                {label}
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {monthDays.map((date, i) => {
              const key = toDateKey(date);
              const isCurrent = date.getMonth() === viewMonth;
              const isToday = key === today;
              const isSelected = key === selectedDate;
              const hasSched = schedulesOn(date).length > 0;
              const dow = date.getDay();
              return (
                <button
                  key={i}
                  onClick={() => selectDate(date)}
                  style={{
                    background: isSelected ? "var(--accent)" : isToday ? "var(--surface-2)" : "transparent",
                    border: isToday && !isSelected ? "1px solid var(--accent)" : "1px solid transparent",
                    borderRadius: 8,
                    padding: "6px 2px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                    cursor: "pointer",
                    opacity: isCurrent ? 1 : 0.3,
                    color: dowColor(dow, isSelected),
                    minHeight: 44,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400 }}>
                    {date.getDate()}
                  </span>
                  {hasSched && (
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: isSelected ? "rgba(255,255,255,0.75)" : "var(--accent)",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* 주 뷰 */}
      {mode === "week" && (
        <>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
            <button className="btn-ghost" style={{ padding: "4px 12px", fontSize: 16 }} onClick={prevWeek}>
              ‹
            </button>
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              {weekDays[0].getMonth() + 1}/{weekDays[0].getDate()} –{" "}
              {weekDays[6].getMonth() + 1}/{weekDays[6].getDate()}
            </span>
            <button className="btn-ghost" style={{ padding: "4px 12px", fontSize: 16 }} onClick={nextWeek}>
              ›
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {weekDays.map((date) => {
              const key = toDateKey(date);
              const isToday = key === today;
              const isSelected = key === selectedDate;
              const daySchedules = schedulesOn(date);
              const dow = date.getDay();
              return (
                <button
                  key={key}
                  onClick={() => selectDate(date)}
                  style={{
                    background: isSelected ? "var(--accent)" : "var(--surface-2)",
                    border: isToday && !isSelected ? "1px solid var(--accent)" : "1px solid transparent",
                    borderRadius: 10,
                    padding: "8px 4px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    cursor: "pointer",
                    minHeight: 90,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      color:
                        isSelected
                          ? "rgba(255,255,255,0.75)"
                          : dow === 0
                          ? "var(--danger)"
                          : dow === 6
                          ? "var(--accent)"
                          : "var(--text-dim)",
                    }}
                  >
                    {DOW_SHORT[dow]}
                  </span>
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: isToday ? 700 : 500,
                      color: isSelected ? "#fff" : dowColor(dow, false),
                    }}
                  >
                    {date.getDate()}
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, width: "100%", padding: "0 2px" }}>
                    {daySchedules.slice(0, 3).map((s) => (
                      <div
                        key={s.id}
                        style={{
                          background: isSelected ? "rgba(255,255,255,0.2)" : "var(--accent-dim)",
                          borderRadius: 3,
                          padding: "1px 4px",
                          fontSize: 10,
                          color: isSelected ? "#fff" : "var(--text)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {s.title}
                      </div>
                    ))}
                    {daySchedules.length > 3 && (
                      <span
                        style={{
                          fontSize: 9,
                          color: isSelected ? "rgba(255,255,255,0.6)" : "var(--text-dim)",
                        }}
                      >
                        +{daySchedules.length - 3}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* 일 뷰 */}
      {mode === "day" && (
        <>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
            <button className="btn-ghost" style={{ padding: "4px 12px", fontSize: 16 }} onClick={prevDay}>
              ‹
            </button>
            <span style={{ fontWeight: 600, fontSize: 15 }}>
              {selectedObj.getMonth() + 1}월 {selectedObj.getDate()}일{" "}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 400,
                  color:
                    selectedObj.getDay() === 0
                      ? "var(--danger)"
                      : selectedObj.getDay() === 6
                      ? "var(--accent)"
                      : "var(--text-dim)",
                }}
              >
                ({DOW_SHORT[selectedObj.getDay()]})
              </span>
              {selectedDate === today && (
                <span style={{ color: "var(--accent)", marginLeft: 8, fontSize: 12, fontWeight: 400 }}>
                  오늘
                </span>
              )}
            </span>
            <button className="btn-ghost" style={{ padding: "4px 12px", fontSize: 16 }} onClick={nextDay}>
              ›
            </button>
          </div>

          {loadingAlarms ? (
            <p className="muted">불러오는 중…</p>
          ) : alarms.length === 0 ? (
            <p className="muted">이 날 예정된 알람이 없어요.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {alarms.map((a) => {
                const stateColor = STATE_COLOR[a.state];
                return (
                  <div key={a.id} className="row" style={{ justifyContent: "space-between" }}>
                    <div className="row">
                      <span
                        className="tag"
                        style={stateColor ? { borderColor: stateColor, color: stateColor } : undefined}
                      >
                        {getStateLabel(a.state)}
                      </span>
                      <span>{scheduleMap.get(a.scheduleId)?.title ?? a.scheduleId}</span>
                    </div>
                    {a.state !== "DONE" && a.state !== "MISSED" && (
                      <button className="btn btn-done" onClick={() => void handleMarkDone(a.id)}>
                        실행했음
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
