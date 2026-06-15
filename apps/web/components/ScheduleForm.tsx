"use client";

import {
  PREMIUM_LOCKED_MESSAGE,
  type MonthlyPart,
  type Recurrence,
  type RecurrenceType,
  type Schedule,
  type Weekday,
} from "@routizen/core";
import { useState } from "react";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const MONTHLY_PARTS: { value: MonthlyPart; label: string }[] = [
  { value: "early", label: "초 (1–10일)" },
  { value: "mid", label: "중 (11–20일)" },
  { value: "late", label: "말 (21–월말)" },
];

export type NewSchedule = Omit<Schedule, "id" | "uid">;

export function ScheduleForm({
  isPremium,
  disabled,
  error,
  onCreate,
}: {
  isPremium: boolean;
  disabled: boolean;
  error?: string | null;
  onCreate: (input: NewSchedule) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [type, setType] = useState<RecurrenceType>("daily");
  const [weekdays, setWeekdays] = useState<Weekday[]>([1, 2, 3, 4, 5]);
  const [monthlyPart, setMonthlyPart] = useState<MonthlyPart>("early");
  const [onceDate, setOnceDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [extraAlarms, setExtraAlarms] = useState<string[]>([]);
  const [newSlot, setNewSlot] = useState("12:00");
  const [submitting, setSubmitting] = useState(false);

  const toggleWeekday = (d: Weekday) =>
    setWeekdays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );

  const addSlot = () => {
    if (!newSlot) return;
    setExtraAlarms((prev) => (prev.includes(newSlot) ? prev : [...prev, newSlot].sort()));
  };
  const removeSlot = (t: string) =>
    setExtraAlarms((prev) => prev.filter((x) => x !== t));

  const buildRecurrence = (): Recurrence => {
    switch (type) {
      case "weekly":
        return { type, weekdays };
      case "monthly":
        return { type, monthlyPart };
      case "once":
        return { type, date: onceDate };
      default:
        return { type: "daily" };
    }
  };

  const valid =
    title.trim() !== "" &&
    startTime < endTime &&
    (type !== "once" || onceDate !== "") &&
    (type !== "weekly" || weekdays.length > 0);

  const submit = async () => {
    if (!valid || disabled) return;
    setSubmitting(true);
    try {
      const ok = await onCreate({
        title: title.trim(),
        memo: memo.trim() || undefined,
        recurrence: buildRecurrence(),
        startTime,
        endTime,
        // 추가 알람 슬롯은 프리미엄만 — 무료는 항상 빈 배열(Firestore 규칙도 동일하게 강제).
        extraAlarms: isPremium ? extraAlarms : [],
        active: true,
      });
      if (ok) {
        setTitle("");
        setMemo("");
        setExtraAlarms([]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card">
      <h2>새 일정 등록</h2>

      {disabled && (
        <div className="locked" style={{ marginBottom: 14 }}>
          무료 일정 한도(10개)에 도달했어요. 일정 무제한은 {PREMIUM_LOCKED_MESSAGE}
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <label>제목</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 아침 스트레칭"
          />
        </div>

        <div>
          <label>반복</label>
          <select
            className="select"
            value={type}
            onChange={(e) => setType(e.target.value as RecurrenceType)}
          >
            <option value="once">한 번</option>
            <option value="daily">매일</option>
            <option value="weekly">매주(요일 선택)</option>
            <option value="monthly">매월(초/중/말)</option>
          </select>
        </div>

        {type === "weekly" && (
          <div className="row" style={{ flexWrap: "wrap" }}>
            {WEEKDAY_LABELS.map((label, i) => {
              const d = i as Weekday;
              const on = weekdays.includes(d);
              return (
                <button
                  key={label}
                  type="button"
                  className={on ? "btn" : "btn-ghost"}
                  style={{ padding: "6px 12px", minWidth: 42 }}
                  onClick={() => toggleWeekday(d)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {type === "monthly" && (
          <div className="row" style={{ flexWrap: "wrap" }}>
            {MONTHLY_PARTS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={monthlyPart === p.value ? "btn" : "btn-ghost"}
                onClick={() => setMonthlyPart(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {type === "once" && (
          <div>
            <label>날짜</label>
            <input
              className="input"
              type="date"
              value={onceDate}
              onChange={(e) => setOnceDate(e.target.value)}
            />
          </div>
        )}

        <div className="row">
          <div style={{ flex: 1 }}>
            <label>시작 시간</label>
            <input
              className="input"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label>끝 시간</label>
            <input
              className="input"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label>메모 (선택)</label>
          <input
            className="input"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>

        {/* 추가 알람 슬롯 — 프리미엄 (기획 2.6) */}
        {isPremium ? (
          <div>
            <label>추가 알람 슬롯 (프리미엄)</label>
            {extraAlarms.length > 0 && (
              <div className="row" style={{ flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {extraAlarms.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="btn-ghost"
                    style={{ padding: "6px 12px" }}
                    onClick={() => removeSlot(t)}
                  >
                    {t} ✕
                  </button>
                ))}
              </div>
            )}
            <div className="row">
              <input
                className="input"
                type="time"
                value={newSlot}
                onChange={(e) => setNewSlot(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="button" className="btn-ghost" onClick={addSlot}>
                추가
              </button>
            </div>
          </div>
        ) : (
          <div className="locked">
            ⭐ 사용자 지정 추가 알람 슬롯은 {PREMIUM_LOCKED_MESSAGE}
          </div>
        )}

        {error && <p style={{ color: "var(--danger)", fontSize: 12 }}>{error}</p>}

        <button className="btn" disabled={!valid || disabled || submitting} onClick={submit}>
          {submitting ? "등록 중…" : "등록"}
        </button>
      </div>
    </div>
  );
}
