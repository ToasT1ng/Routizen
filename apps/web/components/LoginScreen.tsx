"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";

export function LoginScreen() {
  const { signInWithGoogle, signInWithApple } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<void>) => async () => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인에 실패했어요.");
    }
  };

  return (
    <div className="center-screen">
      <div className="card" style={{ width: 340, textAlign: "center" }}>
        <h1>Routizen</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          루틴을 함께 지켜봐요.
        </p>
        <button
          className="btn"
          style={{ width: "100%", marginBottom: 10 }}
          onClick={run(signInWithGoogle)}
        >
          Google로 계속하기
        </button>
        <button
          className="btn-ghost"
          style={{ width: "100%" }}
          onClick={run(signInWithApple)}
        >
          Apple로 계속하기
        </button>
        {error && (
          <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 14 }}>{error}</p>
        )}
      </div>
    </div>
  );
}
