# mju-news

> 명지대학교 공개 공지(일반/장학/행사/진로)를 스크래핑해 JSON으로 제공하는 독립 CLI + Agent Skill.

로그인 없이 접근 가능한 명지대 공식 게시판을 주기적으로 수집하고, 다른 시스템(특히 [`mju-server`](https://github.com/university-claw/mjuclaw-server))이 `execFile`로 호출해서 유저 메시지 처리 흐름에 끼워넣을 수 있도록 설계됐다. 개인 SSO 데이터는 취급하지 않으며, 그 역할은 자매 프로젝트 [`mju-cli`](https://github.com/nullhyeon/mju-cli)의 영역이다.

전체 설계 근거와 아키텍처 의사결정은 [`mju-news-spec.md`](./mju-news-spec.md)와 [`CLAUDE.md`](./CLAUDE.md)를 참고.

## 주요 기능

- **4개 공지 소스 스크래퍼** — 명지대 CMS의 동일 템플릿(`table.artclTable`)을 공유하는 공개 게시판을 하나의 `MjukrBoardScraper`로 처리. `bbsId`는 런타임에 onclick에서 추출되므로 하드코딩이 없다.
- **JSON 우선 출력** — 기본 stdout이 파싱 가능한 JSON. `--format table`로 터미널 가독용 테이블 렌더도 지원.
- **증분 조회** — `new --since <ISO>`가 `scrapedAt` 기준으로 필터링. 동일 공지가 늦게 발견돼도 "새 공지"로 감지된다.
- **파일 기반 저장소** — `data/notices.json` 한 파일. atomic rename 쓰기, 중복 제거(`scrapedAt` 보존), 손상 시 자동 백업 후 복구.
- **스크래퍼 격리** — 한 소스가 실패해도 다른 소스는 계속 수집. 부분 실패는 `sources[id].error`에만 기록되고 exit code는 0.
- **Agent Skill** — `skills/getting-mju-news/SKILL.md`는 Anthropic Agent Skills 표준 + mju-cli의 `metadata.openclaw.*` 확장.
- **단위 테스트** — vitest 기반 46개 테스트. HTML 파싱은 fixture로 네트워크 없이 검증.

## 데이터 소스

| id            | 이름                 | URL                                           |
|---------------|----------------------|-----------------------------------------------|
| `general`     | 일반공지             | `https://www.mju.ac.kr/mjukr/255/subview.do`  |
| `scholarship` | 장학/학자금공지      | `https://www.mju.ac.kr/mjukr/259/subview.do`  |
| `event`       | 행사공지             | `https://www.mju.ac.kr/mjukr/256/subview.do`  |
| `career`      | 진로/취업/창업공지   | `https://www.mju.ac.kr/mjukr/260/subview.do`  |

`general`은 사실상 학사/등록/수강/학위수여 공지를 모두 포함하는 대학본부 공지. 실무상 가장 핵심 소스다.

## 요구 사항

- **Node.js** ≥ 22.0.0
- **npm** (또는 pnpm/yarn)

## 설치

```bash
git clone https://github.com/university-claw/mju-news.git
cd mju-news
npm install
npm run build
```

빌드 후 `dist/main.js`가 CLI 엔트리포인트다. 전역 설치하고 싶으면:

```bash
npm link
mju-news --version
```

## 빠른 시작

```bash
# 환경 점검 (Node 버전, 저장소 권한, 소스 reachability, SKILL.md 검증)
node dist/main.js doctor

# 모든 소스 스크랩 (소스당 최대 30건)
node dist/main.js scrape

# 저장된 공지 최신 10건 조회
node dist/main.js list --limit 10

# 특정 시각 이후 새로 수집된 공지만 (증분 조회)
node dist/main.js new --since 2026-04-08T00:00:00Z

# 사람이 읽기 좋은 테이블 포맷
node dist/main.js --format table list --limit 10
```

## CLI 레퍼런스

### 글로벌 옵션

모든 서브커맨드에서 사용 가능.

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `--data-dir <path>` | `$MJU_NEWS_DATA_DIR` 또는 `./data` | `notices.json` 저장 위치 (절대경로 권장) |
| `--format <fmt>` | `json` | 출력 형식. `json` 또는 `table` |
| `-v, --verbose` | `false` | stderr로 디버그 로그 |
| `-V, --version` | - | 버전 출력 |
| `-h, --help` | - | 도움말 |

### `scrape`

활성 스크래퍼를 실행하고 결과를 저장소에 병합한다. cron의 주 호출 대상.

```bash
mju-news scrape [--sources <ids>] [--limit <n>] [--dry-run]
```

- `--sources <ids>`: 쉼표 구분 id (예: `general,scholarship`). 생략 시 전체 활성 스크래퍼.
- `--limit <n>`: 소스당 최대 공지 수 (기본 `30`).
- `--dry-run`: 저장소에 쓰지 않고 결과만 반환.

출력:
```json
{
  "scrapedAt": "2026-04-08T15:13:13.492Z",
  "sources": {
    "general":     { "fetched": 30, "new": 3, "error": null },
    "scholarship": { "fetched": 30, "new": 1, "error": null },
    "event":       { "fetched":  1, "new": 0, "error": null },
    "career":      { "fetched": 30, "new": 5, "error": null }
  },
  "totalNew": 9,
  "totalStored": 247
}
```

한 소스 실패는 `error` 필드에 기록되고 다른 소스는 계속 진행. 전체 실패 시에만 exit code `1`.

### `list`

저장된 공지를 조회한다. 정렬은 `postedAt` 내림차순.

```bash
mju-news list [--source <id>] [--since <iso>] [--limit <n>]
```

- `--source <id>`: 특정 소스로 필터링.
- `--since <iso>`: `scrapedAt > since` 인 항목만 (ISO 8601).
- `--limit <n>`: 최대 개수 (기본 `50`).

### `new`

특정 시각 이후 **저장소에 들어온** 새 공지만 반환. `mju-server`가 유저 메시지 처리 때 호출하는 핵심 엔드포인트.

```bash
mju-news new --since <iso> [--source <id>] [--limit <n>]
```

`list --since`와 결과는 동일하지만 의도를 분리해 파이프라인이 자기 설명적이게 만든 것.

**중요**: `--since`는 `scrapedAt` 기준이다 (`postedAt` 아님). 학교 사이트에서 늦게 발견된 공지도 "우리 기준 신규"로 잡히게 하는 선택.

### `doctor`

환경/설정 헬스체크. cron 붙이기 전이나 mju-server 통합 시 먼저 돌려본다.

```bash
mju-news doctor
```

점검 항목: Node 버전, data 디렉토리 쓰기 권한, 4개 소스 reachability, `skills/*/SKILL.md` frontmatter 유효성.

### `skills`

등록된 Agent Skill 조회.

```bash
mju-news skills list
mju-news skills show --name getting-mju-news
```

## 출력 스키마

### `Notice`

모든 list/new 응답의 아이템 형식.

```json
{
  "id": "general:230921",
  "source": "general",
  "title": "2026학년도 1학기 수강정정 안내",
  "url": "https://www.mju.ac.kr/bbs/mjukr/141/230921/artclView.do",
  "postedAt": "2026-04-06T15:00:00.000Z",
  "scrapedAt": "2026-04-08T15:13:14.165Z",
  "author": "학사지원팀"
}
```

| 필드 | 의미 |
|------|------|
| `id` | `<source>:<articleNo>` — 재스크랩해도 동일하게 유지 |
| `source` | 스크래퍼 id (`general`/`scholarship`/`event`/`career`) |
| `title` | 공지 제목 (공백 정규화됨) |
| `url` | 원본 상세 페이지 절대 URL |
| `postedAt` | 학교 사이트에 표시된 게시일 (KST를 UTC로 변환한 ISO 8601) |
| `scrapedAt` | 이 Notice가 저장소에 수집된 시각 |
| `author` | 작성자/부서 (선택) |

### 에러 envelope

CLI 실패 시 `--format`과 무관하게 stdout에 JSON을 내보낸다. `mju-server`가 stdout만 파싱하기 때문.

```json
{
  "error": {
    "type": "InputError",
    "message": "--since must be ISO 8601 (got \"not-a-date\")",
    "exitCode": 1
  }
}
```

## mju-server 통합

이 도구의 primary consumer는 [`mju-server`](https://github.com/university-claw/mjuclaw-server)다. 통합 패턴:

1. **빌드된 사본 배치** — `mju-server`는 `mju-server/mju-news/dist/main.js` 경로를 기대한다.
   ```bash
   cd mju-server
   git clone https://github.com/university-claw/mju-news.git
   cd mju-news && npm install --include=dev && npm run build
   ```

2. **cron 스크랩** — 30분마다 전체 스크랩.
   ```bash
   node mju-news/dist/main.js --data-dir mju-news/data --format json scrape
   ```

3. **증분 조회** — 유저 메시지 처리 시 최근 공지 가져오기.
   ```bash
   node mju-news/dist/main.js --data-dir mju-news/data --format json new --since "$LAST_SEEN_AT"
   ```

4. **Skill 설치** — `start.sh`가 NemoClaw 샌드박스에 SKILL.md를 재설치.
   ```bash
   ./scripts/install-skill.sh mjuclaw
   ```

자세한 통합 코드 예시는 [`mju-news-spec.md`](./mju-news-spec.md)의 §12 참고.

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `MJU_NEWS_DATA_DIR` | `./data` | `--data-dir`을 안 줬을 때 쓸 저장소 경로 |
| `MJU_NEWS_HTTP_TIMEOUT` | `10000` | HTTP 요청 타임아웃 (ms) |
| `MJU_NEWS_USER_AGENT` | `mju-news/<ver> (...)` | 스크래퍼 User-Agent |
| `MJU_NEWS_DEBUG` | - | 설정 시 에러 stack을 stderr로 출력 |

## 개발

```bash
# 타입 체크만
npm run check

# 빌드
npm run build

# 개발 모드 (재컴파일 없이)
npm run dev -- scrape --limit 5

# 전체 테스트
npm test

# 개별 테스트 파일
npx vitest run tests/storage/store.test.ts

# 이름 패턴으로 단일 테스트
npx vitest run -t "중복"

# 환경 스모크 체크
./scripts/verify-setup.sh
```

### 테스트 전략

- **순수 함수 위주** — `parseBoardListHtml`을 HTTP와 분리해 fixture HTML로 검증. 실제 네트워크 의존 없음.
- **fixture 기반 회귀 방어** — `tests/scrapers/fixtures/*.html`이 실제 명지대 마크업 구조를 보존. 사이트가 리뉴얼되면 fixture와 셀렉터를 함께 업데이트.
- **E2E 테스트 없음** — 실제 사이트 접근은 선택 사항. 필요 시 별도 플래그 뒤에 추가.

### 프로젝트 구조

```
mju-news/
├── src/
│   ├── main.ts                    # CLI 엔트리
│   ├── types.ts                   # Notice, ScrapeResult 등 JSON 계약
│   ├── errors.ts                  # MjuNewsError 계층
│   ├── commands/                  # scrape, list, new, doctor, skills
│   ├── scrapers/                  # MjukrBoardScraper + 4개 config
│   ├── storage/                   # NoticeStore, dedupe, paths
│   ├── http/                      # got 래퍼
│   ├── output/                    # JSON/table 포매터
│   └── skills/                    # SKILL.md 카탈로그 로더
├── skills/getting-mju-news/       # Agent Skill (NemoClaw가 로드)
├── scripts/                       # install-skill.sh, verify-setup.sh
├── tests/                         # vitest 단위 테스트 + fixture
├── mju-news-spec.md               # 전체 설계 명세
└── CLAUDE.md                      # Claude Code 세션용 레포 가이드
```

## 제약 사항

- **공개 데이터만** — SSO 필요한 개인 데이터는 `mju-cli`로. 이 도구는 로그인 상태를 가지지 않는다.
- **실시간 아님** — cron이 주기적으로 수집. 방금 올라온 공지는 최대 cron 간격만큼 지연된다.
- **`data/notices.json` 단일 프로세스 가정** — 파일 락 없음. 여러 프로세스가 동시에 쓸 일이 없는 cron 운영 전제.
- **학교 사이트 정책 준수** — User-Agent를 명시하고, cron 간격을 지나치게 짧게 줄이지 말 것.

## 라이선스

MIT. 자세한 내용은 [`LICENSE`](./LICENSE) 참고. 명지대 공식 사이트의 공지 내용 저작권은 해당 소유자에게 있으며, 이 도구는 메타데이터(제목/URL/게시일)와 원문 링크만 제공한다.
