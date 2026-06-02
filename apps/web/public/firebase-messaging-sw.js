/* Routizen FCM 웹 푸시 서비스워커 (백그라운드 수신).
 * SW 는 빌드 타임 env 를 못 읽으므로 등록 URL 쿼리스트링으로 전달된
 * Firebase 설정을 사용한다(lib/messaging.ts 의 registerServiceWorker 참조). */
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

const params = new URL(self.location).searchParams;
const config = {
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  storageBucket: params.get("storageBucket"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
};

if (config.projectId) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  // 백그라운드(탭 비활성/닫힘) 메시지 → OS 알림 표시.
  // data-only 발송이므로 제목/본문은 payload.data 에서 읽는다(notify.ts 참조).
  messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {};
    const title = data.title || "Routizen";
    const body = data.body || "";
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      data,
    });
  });
}

// 알림 클릭 시 앱 탭으로 포커스(없으면 새로 열기).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    }),
  );
});
