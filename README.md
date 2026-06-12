# Routizen

루틴 형성을 돕는 스케줄링 앱. 일정마다 시작/끝 알람을 걸고, "실행했음"을 누르지 않으면
끝시간 +1시간 뒤 마지막 재알람(PUSH+이메일)으로 실행을 유도한다.

> 제품/기술 기획: `~/.claude/plans/routizen-abundant-ember.md`

## 모노레포 구조 (npm workspaces)

```
packages/core        도메인 로직 — 타입, 반복일정 계산, 알람 상태머신, 메시지 카탈로그, repo 인터페이스
apps/web             Next.js(SPA export) 웹앱 — 웹/Tauri/Capacitor 공통 번들
apps/desktop         Tauri(맥) 래퍼 — 웹 번들 로드 + Firestore 리스너→OS 로컬 알림, 메뉴바 상주
firebase/functions   Cloud Functions — 알람 엔진(머터리얼라이즈 cron, Cloud Tasks, onAlarmTask), FCM/이메일
firebase/firestore.* 보안 규칙 / 인덱스
```

## 빠른 시작

```bash
npm install            # 전체 워크스페이스 설치
npm run test:core      # 도메인 로직 단위 테스트 (39개)
npm run dev:web        # 웹앱 개발 서버 (http://localhost:3000)
```

웹앱은 `apps/web/.env.example` 를 `.env.local` 로 복사하고 Firebase 웹 설정값을 채워야 동작한다.

## 현재 구현 상태 (MVP)

| 영역 | 상태 |
|---|---|
| 도메인 로직 + 단위 테스트 | ✅ `packages/core` (상태머신/반복/제한/메시지) |
| 웹 인증(Google/Apple) | ✅ `apps/web/lib/auth.tsx` |
| 일정 CRUD + 반복(일/주/월·초중말) | ✅ `apps/web/components` |
| 무료 10개 제한 + 프리미엄 안내 게이팅 | ✅ |
| 알람 스타일(보통/압박, 사용자 전역) | ✅ |
| 알람 엔진(cron + Cloud Tasks + 상태머신) | ✅ `firebase/functions` |
| FCM 푸시 발송 + 마지막 알람 이메일(Resend) | ✅ 서버 발송 `firebase/functions/notify.ts` |
| 웹 FCM 푸시 수신(서비스워커·토큰 등록·포그라운드) | ✅ `apps/web/lib/messaging.ts` |
| 맥앱(Tauri) | 🚧 스캐폴드 + 알림 브리지 `apps/desktop` (Rust 설치·코드서명 후 빌드) |
| 결제 연동 | ✅ Stripe 구독 — 백엔드 코어(`firebase/functions/billing.ts`) + 웹 프리미엄 전환 UI(`apps/web/lib/billing.ts`, 추가 알람 슬롯 해제) |
| iOS/Android(Capacitor) | ⏳ 추후 |

## Firebase 설정 / 배포

1. Firebase 프로젝트 생성, 웹 앱 등록 → `apps/web/.env.local` 채우기
2. Auth: Google·Apple 프로바이더 활성화
3. Cloud Messaging: 웹 푸시 인증서(VAPID 키) 발급 → `apps/web/.env.local` 의 `NEXT_PUBLIC_FIREBASE_VAPID_KEY` 채우기.
   웹앱은 로그인 후 "알림 켜기" 시 서비스워커(`public/firebase-messaging-sw.js`)를 등록하고 FCM 토큰을 `users/{uid}.fcmTokens` 에 저장한다(서버 발송 대상). 알림 아이콘은 `apps/web/public/icon-192.png` 를 두면 사용된다(없어도 동작).
4. Cloud Tasks 큐 생성: 리전 `asia-northeast3`, 큐 이름 `routizen-alarms`
5. 함수 환경변수/시크릿 설정:
   - `ALARM_TASK_URL` (배포된 onAlarmTask URL), `TASK_INVOKER_SA`
   - `TASK_SECRET` (onAlarmTask 호출 검증용 공유 시크릿)
   - `RESEND_API_KEY`, `FROM_EMAIL`
   - 결제(Stripe, 기획 3.5): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `APP_URL`
6. 함수 런타임 타임존을 `Asia/Seoul` 로 설정(현재 KST 운영 가정)
7. 배포:
   ```bash
   cd firebase && firebase deploy --only firestore:rules,firestore:indexes,functions
   ```

### 결제 (Stripe 구독 — 기획 3.5)

Stripe 구독 결제가 연동돼 있다. 웹 대시보드의 "프리미엄" 카드에서 업그레이드 →
`createCheckoutSession` 콜러블이 반환한 Checkout URL 로 이동, 결제 완료 후 웹훅이 `isPremium`
을 켜면 사용자 지정 추가 알람 슬롯(`ScheduleForm`)이 풀린다.

- **`createCheckoutSession`** (callable) — 로그인 사용자가 호출하면 Stripe 고객을 확보하고
  구독 Checkout 세션 URL 을 반환한다. 클라이언트는 그 url 로 리다이렉트한다.
- **`stripeWebhook`** (HTTP) — Stripe 웹훅. 서명 검증 후 `checkout.session.completed` /
  `customer.subscription.*` 이벤트로 `users/{uid}` 의 `subscription`·`isPremium`·`stripeCustomerId`
  를 갱신한다. `isPremium` 은 `subscription.status`(active 도메인 상태 → 프리미엄)에서 파생한다
  (`@routizen/core` 의 `deriveIsPremium`). Stripe 상태 매핑은 active/trialing/past_due 를 프리미엄
  유지로 보고(1회 결제 실패로 즉시 박탈하지 않음), unpaid/canceled/deleted 에서 회수한다.

설정:

1. Stripe 대시보드에서 구독 상품/가격 생성 → `STRIPE_PRICE_ID`
2. `STRIPE_SECRET_KEY` 설정
3. 배포된 `stripeWebhook` URL 을 Stripe 웹훅 엔드포인트로 등록(이벤트: `checkout.session.completed`,
   `customer.subscription.created/updated/deleted`) → 서명 시크릿을 `STRIPE_WEBHOOK_SECRET` 에 설정
4. `APP_URL` 에 웹앱 주소 설정(Checkout 성공/취소 리다이렉트)

> `isPremium`/`subscription` 은 Firestore 규칙상 클라이언트가 변경할 수 없고(서버 전용),
> 오직 Admin SDK(웹훅)만 갱신한다. 에뮬레이터 검증은 Stripe CLI 의 `stripe listen --forward-to`
> + `stripe trigger` 로 가능(실제 Stripe 키 필요).

> 배포 시 `firebase/functions` 의 빌드(`predeploy`)는 esbuild 로 `src/index.ts` 를 단일 ESM
> 번들(`dist/index.js`)로 묶는다. 워크스페이스 패키지 `@routizen/core` 는 번들에 인라인되고,
> 런타임 의존성(firebase-admin 등)만 external 로 남아 클라우드에서 `npm install` 된다.
> 따라서 미게시 워크스페이스 패키지를 클라우드가 해석할 필요가 없다.

## 맥앱 (Tauri)

`apps/desktop` 은 웹 정적 번들(`apps/web/out`)을 그대로 로드하는 Tauri 래퍼다. WKWebView 가
웹푸시를 지원하지 않으므로(기획 3.2), 알림은 공유 번들의 브리지(`apps/web/lib/desktopNotifications.ts`)가
Firestore `notifications` 문서를 실시간 구독해 `@tauri-apps/plugin-notification` 으로 OS 알림을 띄운다.
이 브리지는 Tauri 런타임에서만 동작하고 브라우저에서는 no-op 이다. 창을 닫으면 종료되지 않고
메뉴바(트레이)로 상주해 백그라운드에서 알림 수신을 유지한다.

선행 조건:

```bash
# 1) Rust 툴체인 설치 (https://rustup.rs)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2) (최초 1회) 실제 로고로 아이콘 세트 생성 — 현재는 플레이스홀더 PNG 가 들어있음
npm run icon -w @routizen/desktop      # src-tauri/icons/app-icon.png 를 소스로 사용
```

개발 / 빌드:

```bash
npm run dev:desktop      # 웹 dev 서버 자동 기동 + Tauri 창 (http://localhost:3000 로드)
npm run build:desktop    # 웹 정적 빌드 후 .app/.dmg 번들 생성
```

> 배포(.dmg)에는 Apple 개발자 계정($99/년) 기반 **코드서명·공증**이 필요하다(기획 3.2, 미구현 — 후속).

## 검증 (Firebase Emulator)

```bash
cd firebase && firebase emulators:start --only functions,firestore,auth
# 별도 터미널에서 당일 알람 인스턴스 생성:
curl "http://localhost:5001/<project>/asia-northeast3/materializeNow"
```

- 알람 상태머신: `npm run test:core` (시작→끝→재알람→MISSED, "실행했음" 취소, 멱등 전이)
- 엔드투엔드: 일정 등록 → materialize → 시작/끝/마지막 콜백 발화 → "실행했음" 시 후속 알림 no-op 확인
