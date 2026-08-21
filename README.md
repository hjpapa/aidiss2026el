# AI윤리 펫토론

초등 3–6학년 어린이가 귀여운 관점 펫과 함께 디지털 기술·AI 윤리 문제를 토론하고, 마지막에 자기 발언 근거를 보며 성찰하는 웹앱입니다. 토론 횟수에는 제한이 없고, 다섯 학습 조건을 모두 충족한 뒤에도 원하는 만큼 대화를 이어 갈 수 있습니다.

## 핵심 흐름

1. 여섯 문항으로 오늘 먼저 사용해 볼 관점 펫을 찾습니다. 성격 진단이나 점수가 아닙니다.
2. 여덟 가지 AI·디지털 기술 주제, 처음 입장, 다른 관점의 AI 펫을 고릅니다.
3. 기술 작동 방식, 이익과 위험, 다른 이해관계자, 반론 응답, 이유 있는 입장의 다섯 발자국을 실제 학생 발언 근거로 채웁니다.
4. AI 검토 전에 학생이 먼저 초안을 쓰고, 이후 `학생이 실제로 말한 것 / AI가 해석한 것 / 더 생각해 볼 것`을 구분해 확인한 뒤 자기 말로 최종 성찰을 완성합니다.

## 기술 구성

- Next.js 16 App Router, React 19, TypeScript
- OpenAI Responses API와 구조화 출력, 기본 모델 `gpt-5.6-luna`
- Supabase Postgres 서버 전용 접근
- IndexedDB 로컬 저장과 익명 capability token
- Vitest 단위 테스트, Playwright 브라우저 테스트

모델 호출은 서버 라우트에서만 일어납니다. API 키와 Supabase secret key는 브라우저 번들에 포함되지 않습니다.

## 로컬 실행

Node.js 24 이상을 권장합니다.

```bash
npm ci
copy .env.example .env.local
npm run dev
```

`.env.local`에는 다음 서버 전용 값을 설정합니다.

- `OPENAI_API_KEY`: OpenAI 프로젝트 API 키
- `SUPABASE_URL`: `https://fqbcyornlnxqmchyhlhs.supabase.co`
- `SUPABASE_SECRET_KEY`: `tcontext` 프로젝트의 서버용 secret key
- `SESSION_TOKEN_SECRET`: 32자 이상의 무작위 값
- `PARTICIPANT_HASH_PEPPER`: 식별자 해시용 별도 무작위 값
- `CRON_SECRET`: 만료 데이터 삭제 엔드포인트 보호용 무작위 값

UI만 빠르게 확인할 때는 `APP_MODE=mock`을 사용하면 OpenAI 호출 없이 결정적인 모의 답변이 생성됩니다. 실제 키를 커밋하거나 `NEXT_PUBLIC_` 접두사로 노출하지 마세요.

## Supabase 적용

마이그레이션은 [supabase/migrations](./supabase/migrations) 폴더에 순서대로 정리되어 있습니다. 마지막 검증 마이그레이션은 임시 세션으로 예약 펜싱·재시도·성찰 저장을 확인한 뒤 테스트 데이터를 즉시 삭제합니다.

- 기존 `public.teacher_context_submissions`는 변경하지 않습니다.
- 새 객체는 모두 `aidiss_` 접두사를 사용합니다.
- 새 테이블은 RLS를 켜고 `PUBLIC`, `anon`, `authenticated` 권한을 제거합니다.
- 앱 서버의 `service_role`만 명시적인 CRUD/RPC 권한을 가집니다.
- 세션과 자식 데이터는 29일 뒤 삭제 대상이 됩니다.

기존 프로젝트이므로 `supabase db reset`을 실행하지 마세요. 연결된 프로젝트 ref가 `fqbcyornlnxqmchyhlhs`인지 확인한 뒤 이 마이그레이션만 적용합니다.

## 안전·개인정보 설계

- 이름, 학교, 학년·반·번호, 연락처, 이메일, 주소, SNS ID 등 직접 식별정보로 보이는 입력을 모델 호출 전에 차단합니다.
- OpenAI moderation을 입력과 출력 양쪽에 적용합니다.
- 위기 표현은 토론을 중단하고 가까운 교사·보호자와 긴급 도움을 안내합니다.
- `store: false`로 OpenAI 응답 저장을 끕니다.
- 토론 상태는 서버 HMAC 서명과 버전으로 검증합니다.
- AI가 체크한 학습 조건과 성찰 인용은 실제 `learner/move` 메시지의 정확한 부분 문자열만 허용합니다.
- AI 해석은 학생의 실제 발언과 UI에서 분리하며, 최종 성찰은 학생이 직접 확정합니다.

Supabase가 설정되지 않은 로컬 실행에서는 브라우저 IndexedDB에만 임시 저장되며 UI에 `이 기기에 임시 저장 중`으로 표시됩니다. 서버 저장형 세션에서 일시적인 저장 오류가 발생하면 성공으로 넘기지 않고 다시 시도하도록 안내해 화면과 DB 상태가 어긋나지 않게 합니다. 로컬 기록은 자동으로 서버에 역동기화하지 않습니다.

## 검증

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

브라우저 테스트는 `APP_MODE=mock` 개발 서버를 자동으로 실행하며 데스크톱 Chromium과 모바일 화면을 확인합니다.

## Vercel 배포

1. GitHub 저장소를 Vercel 프로젝트에 연결합니다.
2. `.env.example`의 비어 있는 서버 전용 값을 Production/Preview 환경 변수로 각각 등록합니다.
3. 배포 후 `/api/cron/purge`가 매일 UTC 18:00(한국 시간 오전 3:00)에 실행되는지 확인합니다.
4. 첫 배포에서는 실제 토론 1회, 성찰 완료, 즉시 기록 삭제, 만료 삭제 로그를 확인합니다.

공식 참고: [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna), [OpenAI Responses API](https://developers.openai.com/api/reference/cli/resources/responses/methods/create), [Supabase의 Data API 권한 변경](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
