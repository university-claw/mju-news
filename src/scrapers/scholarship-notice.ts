import { MjukrBoardScraper } from "./board-scraper.js";
import type { ScraperConfig } from "./base.js";

/**
 * 장학/학자금공지 (scholarship & financial aid notices).
 *
 * 명지대 공식 사이트의 "대학생활 > 공지사항 > 장학/학자금공지" 게시판.
 * 국가장학금, 교내장학금, 학자금 대출 관련 공지.
 *
 * menu ID 259.
 */
export const SCHOLARSHIP_NOTICE_CONFIG: ScraperConfig = {
  id: "scholarship",
  name: "장학/학자금공지",
  baseUrl: "https://www.mju.ac.kr/mjukr/259/subview.do",
  enabled: true,
};

export class ScholarshipNoticeScraper extends MjukrBoardScraper {
  constructor() {
    super(SCHOLARSHIP_NOTICE_CONFIG);
  }
}
