import type { Scraper } from "./base.js";
import { GeneralNoticeScraper } from "./general-notice.js";
import { ScholarshipNoticeScraper } from "./scholarship-notice.js";
import { EventNoticeScraper } from "./event-notice.js";
import { CareerNoticeScraper } from "./career-notice.js";

export type { Scraper, ScraperConfig, ScrapeOptions } from "./base.js";
export { MjukrBoardScraper } from "./board-scraper.js";

/**
 * 스크래퍼 레지스트리.
 *
 * 싱글톤 인스턴스로 유지해 scrape 호출마다 new 하지 않는다.
 * 새 스크래퍼 추가 시 여기에 등록하면 자동으로 CLI에 노출.
 */
export const SCRAPERS: Record<string, Scraper> = {
  general: new GeneralNoticeScraper(),
  scholarship: new ScholarshipNoticeScraper(),
  event: new EventNoticeScraper(),
  career: new CareerNoticeScraper(),
};

export function getScraper(id: string): Scraper | undefined {
  return SCRAPERS[id];
}

/**
 * 활성 스크래퍼 목록 반환.
 * @param ids 명시적으로 제공되면 해당 id들만 (순서 유지). 없으면 `enabled: true`인 전체.
 */
export function getActiveScrapers(ids?: string[]): Scraper[] {
  if (ids && ids.length > 0) {
    return ids
      .map((id) => SCRAPERS[id])
      .filter((s): s is Scraper => s !== undefined);
  }
  return Object.values(SCRAPERS).filter((s) => s.config.enabled);
}

/** 모든 등록된 스크래퍼의 id 목록. */
export function listScraperIds(): string[] {
  return Object.keys(SCRAPERS);
}
