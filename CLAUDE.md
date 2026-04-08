# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 현재 상태: 명세만, 구현 없음

이 레포에는 `mju-news-spec.md` 한 개 외에는 아무것도 없다. 코드, package.json, tsconfig 모두 부재. **무엇이든 만들기 전에 `mju-news-spec.md`를 처음부터 끝까지 읽어야 한다** — 이 문서는 새 Claude Code 세션이 0에서부터 전체 프로젝트를 구축할 수 있도록 작성된 self-contained 명세다 (Goals/Non-Goals, 디렉토리 구조, package.json, tsconfig, CLI 표면, 데이터 스키마, SKILL.md, 통합 코드 스니펫까지 전부 포함).

CLAUDE.md(이 파일)는 그 명세를 **재요약하지 않는다**. 대신 명세를 따라 구현할 때 새로 들어온 세션이 놓치기 쉬운 컨텍스트 — 부모 워크스페이스(`mjuclaw/`)와의 계약, 구현 시 자주 무너지는 가정, 형제 레포(`mju-cli`/`mju-server`)와의 경계 — 만 적는다. 부모 디렉토리 `../CLAUDE.md`도 같이 읽는다 (전체 데이터 흐름 다이어그램과 워크스페이스 구조).

## 이 레포가 풀어야 할 진짜 문제

`mju-news`는 단독으로 의미 있는 도구가 아니다. **`mju-server`가 카카오 챗봇 응답에 새 공지를 끼워넣기 위해 30분마다 cron으로 호출하는 저사양 스크래퍼**다. 이 한 줄을 잊으면 잘못된 결정을 한다:

1. **카카오 비즈메시지 푸시 API는 사업자 등록이 필요해서 막혀있다.** 그래서 실시간 push가 아니라 **pull** 구조다 — 유저가 메시지를 보낼 때 그 트랜잭션 안에서 새 공지를 같이 보낸다. WebSocket, SSE, push notification 같은 기능 절대 추가하지 말 것. 명세 §2.2에서 명시적으로 non-goal로 못박혀있다.
2. **개인 데이터는 이 레포가 아니다.** 성적/출석/과제/도서관 대출 — 전부 `../mju-cli`가 처리한다. 그 쪽은 SSO 필요해서 Playwright + 크리덴셜 암호화가 필요한데, 이 레포는 그런 것 없이 공개 HTML만 다룬다. 누가 "LMS 점수도 같이 가져오면 어때?"라고 물으면 거절하고 mju-cli로 보낸다. 책임 분리가 이 레포가 존재하는 이유다.
3. **저사양이 가치다.** cron이 30분마다 부담 없이 돌고, NemoClaw 샌드박스가 재생성될 때마다 플러그인처럼 재설치 가능해야 한다. 명세에서 SQLite도 거부하고 JSON 파일 한 개로 가는 이유 — 네이티브 바인딩 없이 어디서나 `npm install && npm run build`만 되면 끝나야 한다. Playwright도 같은 이유로 금지(`§5.3`).

## `mju-server`가 의존하는 계약 (절대 깨면 안 됨)

`mju-server`(이 레포의 유일한 production consumer)는 `mju-news`를 **import가 아니라 서브프로세스**로 호출한다. `../mju-server/CLAUDE.md`에 명시된 mju-cli 통합 패턴과 동일한 방식이다:

```ts
execFile("node", [
  "<server>/mju-news/dist/main.js",
  "--data-dir", "<server>/mju-news/data",
  "--format", "json",
  "new", "--since", "<ISO8601>"
])
```

이 호출이 깨지지 않으려면 다음을 보장해야 한다:

- **JSON이 기본 출력 형식이다.** `--format` 옵션이 없을 때 stdout은 파싱 가능한 JSON이어야 한다. `console.log` 디버그 메시지를 stdout으로 흘리면 파싱이 깨진다 — 디버그는 `stderr`로, `-v` 플래그 뒤로 숨겨야 한다.
- **에러도 JSON이다.** 명세 §15.4 패턴 그대로 — 에러 발생 시 `{ error: { type, message, exitCode } }` 형태로 stdout에 출력 후 `process.exit(1)`. mju-server가 try/catch로 stdout 파싱을 시도하기 때문.
- **`new --since`가 핵심 엔드포인트다.** 다른 명령(`scrape`, `list`, `doctor`, `skills`)이 다 멀쩡해도 `new --since <ISO>`의 출력 스키마(§7.5)가 깨지면 챗봇이 침묵한다. 변경 시 가장 먼저 검증할 것.
- **CLI 서브커맨드 이름과 출력 스키마는 서버의 `KEYWORD_MAP`에 하드코딩된다.** mju-cli에서 일어나는 함정과 동일 — 서브커맨드 이름이나 JSON 필드를 바꾸면 `mju-server/src/mju-tools.ts`의 매퍼와 `getNewNoticesForUser` 헬퍼를 같이 수정해야 한다. 한쪽만 바꾸면 조용히 망가진다.
- **임베디드 빌드 사본 패턴.** mju-cli와 동일하게, `mju-server`는 `mju-server/mju-news/dist/main.js` 경로의 빌드된 사본을 기대한다. 워크스페이스의 이 레포를 수정했다면 `cd mju-server && rm -rf mju-news && cp -R ../mju-news mju-news && (cd mju-news && npm install --include=dev && npx tsc)`로 동기화해야 변경이 반영된다 (또는 명세 §12.1의 git clone + build 단계). gitignore 되어있어 빌드 사본을 잊기 쉽다.

## NemoClaw skill 통합

`skills/getting-mju-news/SKILL.md`(명세 §11.2)는 단순한 문서가 아니라 **NemoClaw 샌드박스에 설치되는 실행 가능한 자산**이다. 샌드박스가 `nemoclaw onboard`로 재생성될 때마다 workspace가 초기화되므로, `scripts/install-skill.sh`(명세 §11.4)가 `openshell sandbox ssh-config`로 SSH 진입해서 SKILL.md를 다시 박아넣어야 한다. mju-server의 `start.sh`에 이 설치 단계를 추가하는 것이 §12.1에 명시되어 있다.

frontmatter는 Anthropic Agent Skills 표준(`name`, `description`)에 mju-cli의 `metadata.openclaw.*` 확장(`category`, `domain`, `requires.bins`)을 더한 형태다. `requires.bins: ["mju-news"]`만 있고 다른 skill 의존성은 없다. SKILL.md를 수정했을 때 호환성을 검사할 자체 lint는 없으므로 `mju-cli` 쪽 SKILL.md들과 frontmatter 형태를 직접 비교하면서 일관성을 유지한다.

## 빌드/검증 명령 (구현 후 적용)

명세 §13.1과 §6.3 기준으로 다음이 표준이 된다 — 아직 `package.json`이 없으므로 만든 직후부터 적용된다:

```bash
npm install                    # cheerio, commander, got, iconv-lite, vitest
npm run dev -- scrape          # tsx로 즉시 실행 (재컴파일 없이)
npm run check                  # tsc --noEmit, 타입만 검증
npm run build                  # tsc → dist/
node dist/main.js scrape       # 빌드된 CLI 실행
npm run test                   # vitest run (단위 테스트)
npm run test:watch             # vitest watch

# 단일 테스트 실행 (vitest 표준)
npx vitest run tests/storage/store.test.ts
npx vitest run -t "중복 ID는 무시한다"
```

`mju-cli`/`mju-server`와 다른 점: **이 레포는 vitest를 도입한다** (명세 §14.1). 다른 두 레포는 테스트 프레임워크가 없지만 `mju-news`는 스크래퍼 셀렉터 깨짐을 fixture HTML로 잡아내는 것이 가치 있어서 명세에서 vitest를 명시했다. 실제 mju.ac.kr HTML을 `tests/scrapers/fixtures/`에 스냅샷으로 박아두고 오프라인 테스트하는 패턴을 유지한다 — 사이트 구조가 바뀌면 fixture를 갱신하면서 동시에 셀렉터 회귀를 잡는다.

E2E(실제 사이트 fetch) 테스트는 기본으로 skip하고 `E2E=1`일 때만 돌게 한다(`describe.skipIf`).

## 구현할 때 자주 물리는 함정

명세를 따라가더라도 첫 구현에서 빠지기 쉬운 것들:

- **Notice `id`는 영구 키다.** §9.1과 §10.2 — `extractStableKey(url)`이 `articleNo`/`nttId`/`no` 같은 query parameter를 추출하는데, 셀렉터 변경/사이트 리뉴얼로 이 키 추출 방식이 바뀌면 **재스크랩 시 모든 공지가 신규로 잡힌다**. fallback인 `hashFallback(title, postedAt)`도 마찬가지 — 제목 띄어쓰기 한 글자가 바뀌면 새 공지가 된다. ID 생성 로직은 회귀 테스트로 락 걸어야 한다.
- **`postedAt` vs `scrapedAt`은 다른 의미다.** `postedAt`은 학교 사이트가 보여준 게시일, `scrapedAt`은 우리가 수집한 시각. `new --since`의 필터는 `scrapedAt` 기준이고(§10.1의 `list`), 정렬은 `postedAt` 기준이다(같은 함수의 `sort`). 두 개를 섞으면 새로 수집됐지만 게시일이 오래된 공지가 누락된다.
- **EUC-KR 가능성.** 명지대 일부 페이지는 EUC-KR일 수 있어서 명세가 `iconv-lite`를 의존성에 넣었다 (§5.2). got는 기본적으로 UTF-8로 디코딩하므로 EUC-KR 페이지는 깨진 한글이 나온다 — `responseType: 'buffer'`로 받아서 `iconv.decode(buf, 'euc-kr')`로 직접 디코딩해야 한다. 이걸 까먹고 cheerio 결과가 이상할 때가 자주 발생.
- **스크래퍼 격리.** §15.2 — `scrape` 명령은 한 스크래퍼의 실패가 전체 exit code를 1로 만들지 않는다. 부분 실패는 해당 source의 `error` 필드에만 기록하고 stdout JSON은 정상으로 반환한다. mju-server가 부분 실패에서도 살아있는 source의 결과는 쓸 수 있어야 하기 때문.
- **UA와 rate limit.** §16.1 — User-Agent를 명시하고(`mju-news/x.y.z (...)`) 1초 이상 간격을 둔다. 학교 측이 차단하면 도구 자체가 죽으므로 robots.txt 확인까지 doctor 명령에 넣는 것을 고려.
- **`data/` 디렉토리는 gitignore다.** §6.1 — runtime 생성물. `--data-dir` 옵션 없이 호출하면 cwd 기준이라 mju-server가 호출할 땐 반드시 절대 경로로 `--data-dir`를 명시해야 한다 (§12.2 패턴 그대로).
- **유저 격리는 이 레포 책임이 아니다.** mju-cli는 `--app-dir data/users/{kakaoId}`로 유저별 디렉토리를 분리하지만, mju-news는 **공개 데이터**이므로 유저 차원이 없다. 단일 `data/notices.json`을 모든 유저가 공유한다. 유저별 "어디까지 봤는가" 추적은 mju-server의 `getNewNoticesForUser` 헬퍼가 담당한다 — 이 레포에 유저 개념을 넣지 말 것.

## 스택과 컨벤션 (다른 두 레포와 정렬되는 부분)

명세 §5와 §6.2 기준으로:
- **Node ≥22**, **TypeScript 5.9+**, **ESM** (`"type": "module"`, `module: "Node16"`). mju-cli와 동일한 모듈 시스템 — `mju-server`(CommonJS)와는 다르므로 import 경로에 `.js` 확장자를 붙여야 한다.
- **commander.js** CLI 프레임워크, **cheerio** HTML 파서, **got** HTTP 클라이언트. mju-cli와 같은 라이브러리 — 다른 두 레포에서 본 패턴을 그대로 옮길 수 있다는 뜻이다.
- **JSON이 레이어 간 계약이다** (워크스페이스 전체 컨벤션). 새 CLI 커맨드를 추가할 때는 mju-server가 파싱할 스키마를 먼저 설계한다.
- **유저 출력은 한국어**, 코드 식별자/주석은 주변 파일 톤을 따른다 (현재는 명세 외에 코드가 없으므로 처음 만들 때 톤을 정한다 — 명세가 한국어 위주이므로 한국어를 권장).

## 명세 외 지침

명세 §18의 체크리스트(18.1~18.7)는 그대로 구현 순서로 쓸 수 있다. 그 순서를 깨야 할 명확한 이유가 없으면 따른다. 명세 §19.4의 SKILL.md frontmatter 규칙(소문자+숫자+하이픈, `anthropic`/`claude` 금지, description 1024자 이내)은 외부 표준이라 어기면 NemoClaw가 skill을 로드하지 못한다.

부록 A(§부록 A)는 "이 명세를 받은 새 세션에게 주는 지시"가 그대로 적혀있다 — 0에서 시작할 때 그 11단계 시퀀스를 따른다.
