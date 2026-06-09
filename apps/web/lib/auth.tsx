"use client";

import type { User } from "@routizen/core";
import {
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getFirebaseAuth } from "./firebase";
import { createFirebaseRepositories } from "./repositories.firebase";

interface AuthContextValue {
  /** Firebase 인증 사용자 (로딩 중/비로그인 시 null) */
  firebaseUser: FirebaseUser | null;
  /** Routizen 프로필 문서 */
  profile: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (fbUser: FirebaseUser) => {
    const repos = createFirebaseRepositories();
    const p = await repos.users.ensure({
      uid: fbUser.uid,
      email: fbUser.email ?? "",
      displayName: fbUser.displayName ?? undefined,
      photoURL: fbUser.photoURL ?? undefined,
    });
    setProfile(p);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(getFirebaseAuth(), async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        await loadProfile(fbUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [loadProfile]);

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
  }, []);

  const signInWithApple = useCallback(async () => {
    const provider = new OAuthProvider("apple.com");
    provider.addScope("email");
    provider.addScope("name");
    await signInWithPopup(getFirebaseAuth(), provider);
  }, []);

  const signOut = useCallback(async () => {
    // 로그아웃 전에 이 기기의 FCM 토큰을 폐기·제거(공용 기기에서 잔여 푸시 방지).
    // best-effort 라 실패해도 로그아웃은 그대로 진행된다.
    const uid = firebaseUser?.uid;
    if (uid) {
      const { disablePush } = await import("./messaging");
      await disablePush(uid, createFirebaseRepositories());
    }
    await fbSignOut(getFirebaseAuth());
  }, [firebaseUser]);

  const refreshProfile = useCallback(async () => {
    if (firebaseUser) await loadProfile(firebaseUser);
  }, [firebaseUser, loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      profile,
      loading,
      signInWithGoogle,
      signInWithApple,
      signOut,
      refreshProfile,
    }),
    [firebaseUser, profile, loading, signInWithGoogle, signInWithApple, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
