import { MjukrBoardScraper } from "./board-scraper.js";
import type { ScraperConfig } from "./base.js";

/**
 * 행사공지 (event notices).
 *
 * 명지대 공식 사이트의 "대학생활 > 공지사항 > 행사공지" 게시판.
 * 각종 행사, 이벤트, 공모전 공지.
 *
 * menu ID 256.
 */
export const EVENT_NOTICE_CONFIG: ScraperConfig = {
  id: "event",
  name: "행사공지",
  baseUrl: "https://www.mju.ac.kr/mjukr/256/subview.do",
  enabled: true,
};

export class EventNoticeScraper extends MjukrBoardScraper {
  constructor() {
    super(EVENT_NOTICE_CONFIG);
  }
}
