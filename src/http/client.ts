import got, { type OptionsOfTextResponseBody } from "got";
import iconv from "iconv-lite";
import { APP_USER_AGENT } from "../app-meta.js";

const DEFAULT_TIMEOUT_MS = Number(
  process.env.MJU_NEWS_HTTP_TIMEOUT ?? 10_000,
);
const DEFAULT_UA = process.env.MJU_NEWS_USER_AGENT ?? APP_USER_AGENT;

/**
 * 공통 got 인스턴스.
 *
 * 왜 재시도를 GET에 한정하고 4xx는 제외하나:
 * 게시판 리스트는 멱등성 보장되는 GET이고, 4xx는 보통 URL/쿼리 파라미터 문제라
 * 재시도해도 안 풀린다. 5xx와 429, 408만 재시도한다.
 */
const client = got.extend({
  timeout: { request: DEFAULT_TIMEOUT_MS },
  headers: {
    "user-agent": DEFAULT_UA,
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "ko-KR,ko;q=0.9,en;q=0.8",
  },
  retry: {
    limit: 2,
    methods: ["GET", "HEAD"],
    statusCodes: [408, 429, 500, 502, 503, 504],
    errorCodes: [
      "ETIMEDOUT",
      "ECONNRESET",
      "EADDRINUSE",
      "ECONNREFUSED",
      "EPIPE",
      "ENOTFOUND",
      "ENETUNREACH",
      "EAI_AGAIN",
    ],
  },
  throwHttpErrors: true,
  followRedirect: true,
});

/** 일반 UTF-8 HTML 페이지 fetch. */
export async function httpGet(
  url: string,
  options?: OptionsOfTextResponseBody,
): Promise<string> {
  const response = await client.get(url, options);
  return response.body;
}

/**
 * EUC-KR 가능성이 있는 페이지 fetch.
 *
 * 명지대 메인 게시판은 UTF-8이지만 일부 구 학과 페이지는 EUC-KR 잔존 가능.
 * buffer로 받아 content-type의 charset 힌트로 디코딩한다.
 * 힌트가 없으면 UTF-8 → EUC-KR 순서로 fallback.
 */
export async function httpGetAutoDecode(url: string): Promise<string> {
  const response = await client.get(url, {
    responseType: "buffer",
    decompress: true,
  });
  const buffer = response.rawBody;

  const contentType = response.headers["content-type"] ?? "";
  const charsetMatch = /charset=([^;]+)/i.exec(contentType);
  const charset = charsetMatch?.[1]?.trim().toLowerCase();

  if (charset && charset !== "utf-8" && iconv.encodingExists(charset)) {
    return iconv.decode(buffer, charset);
  }
  // UTF-8로 먼저 시도. BOM 또는 <meta charset>에 EUC-KR이 있으면 재디코딩.
  const utf8 = buffer.toString("utf-8");
  const metaCharset = /<meta[^>]+charset=["']?([^"'>\s]+)/i.exec(utf8);
  if (metaCharset?.[1]) {
    const metaCs = metaCharset[1].toLowerCase();
    if (metaCs !== "utf-8" && iconv.encodingExists(metaCs)) {
      return iconv.decode(buffer, metaCs);
    }
  }
  return utf8;
}

/**
 * 단순 reachability 체크 (doctor 커맨드용).
 * 전체 body를 받지 않고 HEAD 또는 짧은 GET으로 확인.
 */
export async function httpCheck(
  url: string,
): Promise<{ reachable: boolean; error?: string }> {
  try {
    // HEAD를 막아두는 서버가 있어서 GET이지만 짧은 timeout과 stream cancel.
    const response = await client.get(url, {
      timeout: { request: 5_000 },
      retry: { limit: 0 },
    });
    return { reachable: response.statusCode < 400 };
  } catch (err) {
    return {
      reachable: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
