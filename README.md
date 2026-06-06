# Routizen

루틴 형성을 돕는 스케줄링 앱. 일정마다 시작/끝 알람을 걸고, "실행했음"을 누르지 않으면
끝시간 +1시간 뒤 마지막 재알람(PUSH+이메일)으로 실행을 유도한다.

> 제품/기술 기획: `~/.claude/plans/routizen-abundant-ember.md`

## 모노레포 구조 (npm workspaces)

```
packages/core        도메인 로직 — 타입, 반복일정 계산, 알람 상태머신, 메시지 카탈로그, repo 인터페이스
apps/web             Next.js(SPA export) 웹앱 — 웹/Tauri/Capacitor 공통 번들
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
| FCM 푸시 + 마지막 알람 이메일(Resend) | ✅ |
| 맥앱(Tauri) | ⏳ 미착수 (로드맵 2단계) |
| 결제 연동 | ⏳ 초기 미연동 — 안내 문구만 (기획 3.5) |
| iOS/Android(Capacitor) | ⏳ 추후 |

## Firebase 설정 / 배포

1. Firebase 프로젝트 생성, 웹 앱 등록 → `apps/web/.env.local` 채우기
2. Auth: Google·Apple 프로바이더 활성화
3. Cloud Tasks 큐 생성: 리전 `asia-northeast3`, 큐 이름 `routizen-alarms`
4. 함수 환경변수/시크릿 설정:
   - `ALARM_TASK_URL` (배포된 onAlarmTask URL), `TASK_INVOKER_SA`
   - `TASK_SECRET` (onAlarmTask 호출 검증용 공유 시크릿)
   - `RESEND_API_KEY`, `FROM_EMAIL`
5. 함수 런타임 타임존을 `Asia/Seoul` 로 설정(현재 KST 운영 가정)
6. 배포:
   ```bash
   cd firebase && firebase deploy --only firestore:rules,firestore:indexes,functions
   ```

> 배포 시 `firebase/functions` 의 빌드(`predeploy`)는 esbuild 로 `src/index.ts` 를 단일 ESM
> 번들(`dist/index.js`)로 묶는다. 워크스페이스 패키지 `@routizen/core` 는 번들에 인라인되고,
> 런타임 의존성(firebase-admin 등)만 external 로 남아 클라우드에서 `npm install` 된다.
> 따라서 미게시 워크스페이스 패키지를 클라우드가 해석할 필요가 없다.

## 검증 (Firebase Emulator)

```bash
cd firebase && firebase emulators:start --only functions,firestore,auth
# 별도 터미널에서 당일 알람 인스턴스 생성:
curl "http://localhost:5001/<project>/asia-northeast3/materializeNow"
```

- 알람 상태머신: `npm run test:core` (시작→끝→재알람→MISSED, "실행했음" 취소, 멱등 전이)
- 엔드투엔드: 일정 등록 → materialize → 시작/끝/마지막 콜백 발화 → "실행했음" 시 후속 알림 no-op 확인
