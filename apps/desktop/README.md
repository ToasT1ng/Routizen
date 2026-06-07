# @routizen/desktop

Routizen 맥앱 — 웹 정적 번들(`apps/web/out`)을 로드하는 [Tauri](https://tauri.app) v2 래퍼.

- **알림**: 공유 웹 번들의 브리지(`apps/web/lib/desktopNotifications.ts`)가 Firestore
  `notifications` 문서를 구독해 `@tauri-apps/plugin-notification` 으로 OS 로컬 알림을 띄운다.
  (WKWebView 는 웹푸시 미지원 — 기획 3.2)
- **상주**: 창을 닫으면 종료되지 않고 메뉴바(트레이)로 상주, 백그라운드에서 알림 수신 유지.

설치/실행 선행 조건과 명령은 레포 루트 [`README.md`](../../README.md) 의 "맥앱 (Tauri)" 절 참고.

> `src-tauri/icons/*` 는 플레이스홀더(단색)다. 릴리스 전 실제 로고로
> `npm run icon -w @routizen/desktop` 실행해 교체할 것.
