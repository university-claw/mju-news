import type { Notice, NoticeSource } from "../types.js";

/** 스크래퍼가 자기소개로 제공하는 정적 설정. */
export interface ScraperConfig {
  /** 레지스트리/CLI에서 쓰는 안정적 id (예: "academic"). */
  id: NoticeSource;
  /** 사람이 읽는 이름 (예: "학사공지"). */
  name: string;
  /** 목록 페이지 URL (list 엔드포인트). */
  baseUrl: string;
  /** true면 scrape 명령이 기본으로 이 스크래퍼를 돌린다. */
  enabled: boolean;
}

export interface ScrapeOptions {
  /** 한 번에 가져올 최대 notice 수. */
  limit?: number;
}

/** 모든 스크래퍼가 준수해야 하는 인터페이스. */
export interface Scraper {
  readonly config: ScraperConfig;
  scrape(options?: ScrapeOptions): Promise<Notice[]>;
}
