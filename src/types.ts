/**
 * mju-news 전역 타입.
 *
 * 이 파일의 형상이 곧 mju-server와의 JSON 계약이다.
 * 필드 추가/제거는 mju-server/src/mju-tools.ts의 파서/포매터와 동시에 맞춰야 한다.
 */

/** 공지 카테고리 ID. 스크래퍼 레지스트리 키와 동일. */
export type NoticeSource = string;

/** 공지 단일 항목. 저장소/CLI/에이전트가 공유하는 정규화 스키마. */
export interface Notice {
  /** "<source>:<stable-key>" 형식. 재스크랩해도 같은 공지는 같은 ID여야 함. */
  id: string;
  /** 스크래퍼 레지스트리 키 (예: "academic"). */
  source: NoticeSource;
  /** 공지 제목 (원문 그대로, trim만). */
  title: string;
  /** 원본 상세 페이지 절대 URL. */
  url: string;
  /** 학교 사이트에 표시된 게시일 (ISO 8601 UTC). */
  postedAt: string;
  /** 작성자/부서명. 사이트에 없으면 생략. */
  author?: string;
  /** 본문 요약/첫 줄. 초기 구현에서는 대개 생략. */
  summary?: string;
  /** 이 Notice가 저장소에 수집된 시각 (ISO 8601 UTC). */
  scrapedAt: string;
}

/** `scrape` 커맨드의 소스별 결과. */
export interface SourceResult {
  /** 사이트에서 가져온 row 수 (중복 포함). */
  fetched: number;
  /** 저장소에 실제로 새로 추가된 수 (중복 제외). */
  new: number;
  /** 실패 시 메시지. 성공은 null. */
  error: string | null;
}

/** `scrape` 커맨드의 전체 결과. */
export interface ScrapeResult {
  scrapedAt: string;
  sources: Record<NoticeSource, SourceResult>;
  totalNew: number;
  totalStored: number;
}

/** `list` / `new` 커맨드의 응답. */
export interface ListResult {
  total: number;
  items: Notice[];
}

/** `doctor` 커맨드의 헬스체크 결과. */
export interface DoctorResult {
  node: { version: string; ok: boolean };
  dataDir: { path: string; writable: boolean };
  sources: Record<
    NoticeSource,
    { url: string; reachable: boolean; error?: string }
  >;
  skills: Array<{ name: string; valid: boolean; error?: string }>;
  ok: boolean;
}

/** `--format` 옵션 값. */
export type OutputFormat = "json" | "table";

/** 모든 커맨드에 공통으로 붙는 글로벌 옵션. */
export interface GlobalOptions {
  dataDir: string;
  format: OutputFormat;
  verbose: boolean;
}

/**
 * CLI가 실패했을 때 stdout으로 내보내는 JSON 에러 envelope.
 * mju-server가 exec 결과를 try-parse하기 때문에 stderr가 아니라 stdout이다.
 */
export interface ErrorEnvelope {
  error: {
    type: string;
    message: string;
    exitCode: number;
    details?: unknown;
  };
}
