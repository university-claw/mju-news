# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 현재 상태: v2.0.0 — Reader 피벗 (BREAKING)

`mju-news`는 **스크래퍼에서 Reader로 전면 전환됐다**. 이제 이 레포는 HTML을 긁지 않는다. `mju-public-data-worker`가 수집·OCR·정규화해서 Postgres `public_data` 스키마에 써둔 데이터를 **읽기만** 한다. 상세한 제거/변경 이력은 `CHANGELOG.md` 참고.

워크스페이스 루트 `../CLAUDE.md`와 `../data-worker.md`를 먼저 읽으면 전체 흐름이 보인다.

## 이 레포가 풀어야 할 진짜 문제

**mjuclaw Discord agent가 공개 정보(공지/학식)를 조회할 때 단일 통로.** worker가 쓴 Postgres를 JSON CLI로 감싸서, openclaw가 `exec` 도구로 때리면 바로 쓸 수 있는 read 레이어를 제공한다. 한 줄이면: worker ↔ agent 사이의 **브릿지 스킬**.

- 스크래핑을 여기서 하지 말 것. 사이트 구조 변경 대응은 `mju-public-data-worker` 책임.
- 개인 데이터(LMS 성적/출석/과제)는 `../mju-cli` 책임. 이 레포에 SSO/크리덴셜 흔적이 생기면 경계가 무너진다.
- 실시간 push 금지(메신저 플랫폼 제약). 모든 조회는 pull.

## DB 접근 구조

- 연결은 `pg` 클라이언트 풀. 환경변수는 `PGHOST`/`PGPORT`/`PGDATABASE`/`PGUSER`/`PGPASSWORD`/`PGSCHEMA` (기본 `public_data`).
- `.env` 파일을 dotenv로 자동 로드. 호스트 Postgres가 전제이므로 `PGHOST=127.0.0.1`가 일반 케이스.
- `src/db/client.ts`가 pool 싱글톤, connection마다 `SET search_path TO <schema>, public`을 걸어 쿼리에서 스키마 prefix를 줄인다.
- 각 커맨드 action이 끝날 때 `closePool()`로 connection 해제 — Node가 hang 상태로 남지 않도록 반드시 호출.

## 커맨드 맵

```
mju-news
├── notices recent [--limit N] [--category X] [--since ISO]
├── notices search --q KEYWORD [--limit N] [--category X] [--since ISO]
├── notices get <source>:<external_id>
├── cafeterias today [--meal M] [--where W] [--date YYYY-MM-DD]
├── cafeterias week --start YYYY-MM-DD [--meal M] [--where W]
├── doctor
└── skills list|show
```

각 서브커맨드는 `src/commands/*.ts`에서 builder 함수 export. 글로벌 옵션(`--format`, `--verbose`)은 `commands/common.ts`에서 주입.

## 계약 (절대 깨면 안 됨)

`mju-news`는 이제 **mjuclaw agent(Discord/openclaw gateway)가 유일한 프로덕션 소비자**다. 호출 형태:

```ts
execFile("mju-news", [
  "notices", "recent",
  "--format", "json",
  "--limit", "20",
]);
```

agent는 stdout을 `JSON.parse`하고 stderr는 무시한다. 따라서:

- **JSON이 기본 출력이다.** `console.log` 디버그는 stderr로. stdout을 오염시키면 파싱이 깨진다.
- **에러도 JSON envelope다.** `src/main.ts`의 catch 핸들러가 어떤 예외든 `{ error: { type, message, exitCode } }`로 stdout에 찍고 `exit 1`. 예외 타입은 `err.name` — 그래서 각 커스텀 에러 클래스(`DbError`, `NotFoundError`, `InputError` 등)가 `name`을 명시적으로 세팅한다.
- **서브커맨드 이름과 출력 스키마는 SKILL.md에 문서화되어 있다.** 이름/스키마 변경은 `skills/getting-mju-news/SKILL.md`와 동시에 갱신.
- **`closePool()`을 잊지 말 것.** 각 커맨드 action의 finally에서 호출해야 프로세스가 바로 종료된다. 빼먹으면 agent가 10초 timeout 기다리게 됨.

## 빌드/검증

```bash
npm install
npm run check                 # tsc --noEmit
npm run build                 # tsc → dist/
npm run dev -- notices recent # tsx로 즉시 실행
node dist/main.js notices recent
npm run test                  # vitest run

# 실DB smoke test (먼저 .env에 PG 정보를 넣고 worker가 한 번 이상 돌았어야 함)
npm run dev -- doctor
npm run dev -- cafeterias today --format json
```

## 의존성 지도

- `pg` — Postgres 클라이언트
- `dotenv` — `.env` 로드
- `commander` — CLI
- `cli-table3` — table 포맷
- **제거됨**: `cheerio`, `got`, `iconv-lite` (스크래퍼용이었음)

## 자주 물리는 함정

- **DB 장애를 디버그할 때**: `doctor`가 `database.error`에 원본 메시지를 담는다. 보통 `PGHOST`/`PGPORT` 오타, Postgres 미기동, 비번 오류.
- **`search_path` 세팅 타이밍**: connection이 pool에 처음 들어올 때 `SET search_path`가 걸린다. 초기 `SELECT 1`을 던지기 전에 connection 재사용이 많지 않아 큰 이슈는 없지만, raw query에서 스키마를 명시하고 싶으면 `public_data.notice_items`로 직접 써도 된다.
- **notices `id`의 형태**: `<source>:<external_id>` (예: `general:12345`). `notices get` 인자로 그대로 전달. source 오타나 콜론 누락이면 `InputError`.
- **학식 `today` KST 기준**: Postgres timezone은 `Asia/Seoul`로 맞춰져 있지만, today 커맨드는 Node 측에서 계산한다. `--date` 옵션으로 덮어쓸 수 있음.
- **read model은 worker 결과에 의존**: 공지의 `notice_items`는 worker의 `collect notices`, 학식의 `cafeteria_menu_entries`는 worker의 `collect cafeterias` 이후에만 채워진다. 빈 응답이면 worker scheduler tick이 돌고 있는지 먼저 확인.
- **SKILL.md frontmatter 규칙**: 이름은 소문자+숫자+하이픈, `anthropic`/`claude` 금지, description ≤ 1024자. 외부 표준이라 어기면 skill이 로드되지 않는다.

## 스택과 컨벤션

- **Node ≥22**, **TypeScript 5.9+**, **ESM** (`"type": "module"`, `module: "Node16"`). import 경로에 `.js` 확장자 필수.
- **JSON이 레이어 간 계약이다.** 새 명령을 추가할 때는 agent 측 파서/프롬프트까지 같이 염두.
- **유저 출력은 한국어**, 코드 주석은 한국어/영어 혼용. 주변 파일 톤을 따른다.
