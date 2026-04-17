# Changelog

## 2.0.0 — 2026-04-17 (BREAKING)

### 피벗: 스크래퍼 → Reader

`mju-news`의 정체성을 통째로 바꿨다. 기존 HTML/RSS 스크래퍼는 `mju-public-data-worker`로 이관됐고, 이 레포는 이제 worker가 쓴 Postgres `public_data` 스키마를 읽어서 mjuclaw Discord agent에 JSON을 제공하는 **Reader 스킬**이다.

### 제거

- `src/scrapers/*` — 게시판 HTML 파서, RSS 병합, `MjukrBoardScraper` 전부
- `src/http/*` — got 래퍼, EUC-KR 디코딩
- `src/storage/*` — `data/notices.json` 단일 파일 저장소, dedupe, atomic rename
- `scrape` 서브커맨드
- `list` 서브커맨드 (→ `notices recent`)
- `new --since` 서브커맨드 (→ `notices recent --since`)
- `--data-dir` 글로벌 옵션 (파일 저장소가 사라짐)
- 의존성: `cheerio`, `got`, `iconv-lite`
- fixture 기반 scrape 테스트 전부
- `mju-news-spec.md` (옛 명세)

### 추가

- **DB 클라이언트** `src/db/client.ts` — pg pool 싱글톤 + dotenv + `search_path` 자동 세팅
- **공지 쿼리** `src/db/notices.ts` — `listRecentNotices`, `searchNotices`, `getNoticeDetail`
- **학식 쿼리** `src/db/cafeterias.ts` — `listCafeteriaMenuEntries`
- **doctor 쿼리** `src/db/doctor.ts` — read model 카운트/최신 시각
- 서브커맨드:
  - `notices recent [--limit N] [--category general|scholarship|event|career] [--since ISO]`
  - `notices search --q <keyword> [--limit N] [--category] [--since ISO]`
  - `notices get <source>:<external_id>` — 본문 + 첨부 추출 텍스트 + 이미지 OCR
  - `cafeterias today [--meal breakfast|lunch|dinner] [--where student-hall|myeongjin|bokji|bangmok] [--date YYYY-MM-DD]`
  - `cafeterias week --start YYYY-MM-DD [--meal] [--where]`
- 의존성: `pg`, `@types/pg`, `dotenv`
- `.env.example`

### 변경

- `src/types.ts` 전체 재설계 — Postgres 스키마의 투영
- `src/commands/common.ts` — `--data-dir` 제거, date/positive-int 헬퍼 추가
- `src/commands/doctor.ts` — DB 연결 + read model 통계 + skills 검증으로 재작성
- `src/output/table.ts` — notice-detail / cafeterias 테이블 렌더러 추가
- `src/errors.ts` — `ScraperError` / `StoreError` 제거, `DbError` / `ConfigError` / `NotFoundError` 추가
- `skills/getting-mju-news/SKILL.md` 본문 전면 재작성 (Discord 기준)
- `CLAUDE.md` 전면 재작성

### 환경

- **Postgres 필수.** `PGHOST`/`PGPORT`/`PGDATABASE`/`PGUSER`/`PGPASSWORD`/`PGSCHEMA` 환경변수 또는 `.env` 필요.
- **worker 선행.** `mju-public-data-worker`가 한 번 이상 migrate + collect를 돌려 read model을 채워둬야 의미 있는 응답이 나온다.
