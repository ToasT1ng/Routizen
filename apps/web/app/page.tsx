"use client";

import { Dashboard } from "@/components/Dashboard";
import { LoginScreen } from "@/components/LoginScreen";
import { useAuth } from "@/lib/auth";

export default function HomePage() {
  const { firebaseUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="center-screen">
        <span className="muted">불러오는 중…</span>
      </div>
    );
  }

  return firebaseUser ? <Dashboard /> : <LoginScreen />;
}
