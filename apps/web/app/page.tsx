"use client";

import { Dashboard } from "@/components/Dashboard";
import { LoginScreen } from "@/components/LoginScreen";
import { useAuth } from "@/lib/auth";
import { useDesktopNotifications } from "@/lib/useDesktopNotifications";

export default function HomePage() {
  const { firebaseUser, loading } = useAuth();

  // 데스크톱(Tauri)에서만 Firestore notifications → OS 로컬 알림. 브라우저에선 no-op.
  useDesktopNotifications(firebaseUser?.uid);

  if (loading) {
    return (
      <div className="center-screen">
        <span className="muted">불러오는 중…</span>
      </div>
    );
  }

  return firebaseUser ? <Dashboard /> : <LoginScreen />;
}
