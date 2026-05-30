import type {
  AlarmInstance,
  AlarmStyle,
  Repositories,
  Schedule,
  User,
} from "@routizen/core";
import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "./firebase";

const DEFAULT_USER: Omit<User, "uid" | "email" | "displayName" | "photoURL"> = {
  isPremium: false,
  subscription: { provider: null, status: "none", currentPeriodEnd: null },
  alarmStyle: "normal",
  fcmTokens: [],
  timezone: "Asia/Seoul",
};

/** Firestore 구현체 — core의 Repositories 인터페이스를 만족 */
export function createFirebaseRepositories(): Repositories {
  const db = getDb();

  return {
    users: {
      async get(uid) {
        const snap = await getDoc(doc(db, "users", uid));
        return snap.exists() ? ({ uid, ...snap.data() } as User) : null;
      },
      async ensure(input) {
        const ref = doc(db, "users", input.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) return { uid: input.uid, ...snap.data() } as User;
        const user: User = {
          uid: input.uid,
          email: input.email,
          displayName: input.displayName,
          photoURL: input.photoURL,
          ...DEFAULT_USER,
        };
        await setDoc(ref, user);
        return user;
      },
      async setAlarmStyle(uid, style: AlarmStyle) {
        await updateDoc(doc(db, "users", uid), { alarmStyle: style });
      },
    },

    schedules: {
      async listActive(uid) {
        const q = query(
          collection(db, "schedules"),
          where("uid", "==", uid),
          where("active", "==", true),
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Schedule);
      },
      async countActive(uid) {
        const q = query(
          collection(db, "schedules"),
          where("uid", "==", uid),
          where("active", "==", true),
        );
        const snap = await getCountFromServer(q);
        return snap.data().count;
      },
      async create(input) {
        const ref = doc(collection(db, "schedules"));
        await setDoc(ref, input);
        return { id: ref.id, ...input };
      },
      async update(id, patch) {
        await updateDoc(doc(db, "schedules", id), patch);
      },
      async remove(id) {
        await deleteDoc(doc(db, "schedules", id));
      },
    },

    alarms: {
      async listByDate(uid, date) {
        const q = query(
          collection(db, "alarmInstances"),
          where("uid", "==", uid),
          where("date", "==", date),
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AlarmInstance);
      },
      async markDone(id) {
        // 클라이언트는 상태/완료시각만 기록. 예약된 Cloud Tasks 는
        // 실행 시 상태를 확인하므로(멱등) 별도 취소 불필요 — 기획 3.3.
        await updateDoc(doc(db, "alarmInstances", id), {
          state: "DONE",
          completedAt: serverTimestamp(),
        });
      },
    },
  };
}
