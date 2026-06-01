import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let cachedApp: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (cachedApp) return cachedApp;
  cachedApp = getApps().length ? getApps()[0]! : initializeApp(config);
  return cachedApp;
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

let cachedDb: Firestore | null = null;

export function getDb(): Firestore {
  if (cachedDb) return cachedDb;
  // ignoreUndefinedProperties: 선택 필드(memo/displayName/photoURL 등)가 undefined 여도
  // 쓰기가 실패하지 않도록(기본값은 undefined 시 예외).
  try {
    cachedDb = initializeFirestore(getFirebaseApp(), { ignoreUndefinedProperties: true });
  } catch {
    // 이미 초기화된 경우(중복 호출) 기존 인스턴스 사용
    cachedDb = getFirestore(getFirebaseApp());
  }
  return cachedDb;
}
