import { load as loadHtml } from "cheerio";
import { httpGet } from "../http/client.js";
import { ScraperError } from "../errors.js";
import type { Notice } from "../types.js";
import { buildNoticeId } from "../storage/dedupe.js";
import type { Scraper, ScraperConfig, ScrapeOptions } from "./base.js";
import {
  buildArticleDetailUrl,
  collapseWhitespace,
  extractArticleNoFromOnclick,
  parseKoreanDate,
} from "./helpers.js";

/**
 * HTML 한 페이지를 파싱해 Notice 배열로 만든다. HTTP와 분리해 단위 테스트
 * 가능하도록 순수 함수로 둔다.
 *
 * 마크업 가정:
 *  - 목록은 `table.artclTable > tbody > tr`
 *  - 제목은 td의 `<a>` 태그, onclick에 `jf_viewArtcl('mjukr','<bbsId>','<articleNo>','t')`
 *  - 날짜는 별도 td, "YYYY.MM.DD" 형식
 *
 * @throws ScraperError 행이 전혀 매칭되지 않거나, 매칭됐지만 하나도 파싱 성공 못 할 때
 */
export function parseBoardListHtml(
  html: string,
  config: Pick<ScraperConfig, "id" | "baseUrl">,
  scrapedAt: string,
  limit: number,
): Notice[] {
  const $ = loadHtml(html);
  const origin = new URL(config.baseUrl).origin;
  const notices: Notice[] = [];
  const errors: string[] = [];

  const rows = $("table.artclTable tbody tr").toArray();
  if (rows.length === 0) {
    throw new ScraperError(
      config.id,
      "no rows matched 'table.artclTable tbody tr' — markup may have changed",
    );
  }

  for (const row of rows) {
    try {
      const $row = $(row);

      if ($row.find("td._noData").length > 0) continue;

      const tds = $row.find("td").toArray();
      if (tds.length < 4) continue;

      const $titleA = $(tds[1]).find("a").first();
      const title = collapseWhitespace($titleA.text());
      if (!title) continue;

      const href = $titleA.attr("href");
      const onclick = $titleA.attr("onclick");
      let detailUrl: string | null = null;

      if (href && !href.startsWith("#") && !href.startsWith("javascript")) {
        detailUrl = new URL(href, origin).toString();
      } else {
        const articleNo = extractArticleNoFromOnclick(onclick);
        if (articleNo) {
          const m = /jf_viewArtcl\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"](\d+)['"]/.exec(
            onclick ?? "",
          );
          const site = m?.[1] ?? "mjukr";
          const bbsId = m?.[2] ?? "";
          if (bbsId) {
            detailUrl = buildArticleDetailUrl(origin, site, bbsId, articleNo);
          }
        }
      }
      if (!detailUrl) continue;

      const dateText = collapseWhitespace($(tds[3]).text());
      const postedAt = parseKoreanDate(dateText);
      const author = collapseWhitespace($(tds[2]).text()) || undefined;

      const id = buildNoticeId(config.id, detailUrl, title, postedAt);

      const notice: Notice = {
        id,
        source: config.id,
        title,
        url: detailUrl,
        postedAt,
        scrapedAt,
      };
      if (author) notice.author = author;

      notices.push(notice);
      if (notices.length >= limit) break;
    } catch (rowErr) {
      errors.push(rowErr instanceof Error ? rowErr.message : String(rowErr));
    }
  }

  if (notices.length === 0) {
    throw new ScraperError(
      config.id,
      `scraped 0 notices from ${rows.length} rows${
        errors.length > 0
          ? ` (row errors: ${errors.slice(0, 3).join("; ")})`
          : ""
      }`,
    );
  }

  return notices;
}

/**
 * 명지대 mjukr 계열 게시판 공통 스크래퍼.
 *
 * 명지대 게시판 (www.mju.ac.kr/mjukr/<menuId>/subview.do)은 같은 CMS
 * 템플릿(`.artclTable`)을 공유한다. 이 클래스는 URL/id/name만 다른
 * 소스들을 하나의 구현으로 처리한다.
 */
export class MjukrBoardScraper implements Scraper {
  readonly config: ScraperConfig;

  constructor(config: ScraperConfig) {
    this.config = config;
  }

  async scrape({ limit = 30 }: ScrapeOptions = {}): Promise<Notice[]> {
    let html: string;
    try {
      html = await httpGet(this.config.baseUrl);
    } catch (err) {
      throw new ScraperError(
        this.config.id,
        `failed to fetch ${this.config.baseUrl}: ${
          err instanceof Error ? err.message : String(err)
        }`,
        { cause: err },
      );
    }
    const scrapedAt = new Date().toISOString();
    return parseBoardListHtml(html, this.config, scrapedAt, limit);
  }
}
