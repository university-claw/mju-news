import crypto from "node:crypto";

/**
 * URL에서 사이트가 부여한 안정적인 게시글 키를 추출한다.
 *
 * 명지대 게시판은 여러 패턴을 혼용한다:
 *  - path: `/bbs/mjukr/141/230921/artclView.do` → 230921
 *  - query: `?articleNo=123`, `?nttId=456`, `?no=789`
 *
 * path 패턴은 보통 `/bbs/<site>/<bbsId>/<articleNo>/artclView.do` 형태.
 */
export function extractStableKey(url: string): string | null {
  try {
    const u = new URL(url);

    // path 기반: /bbs/.../<articleNo>/artclView.do
    const pathMatch = /\/bbs\/[^/]+\/[^/]+\/(\d+)\/artcl(?:View|Form)\.do/.exec(
      u.pathname,
    );
    if (pathMatch?.[1]) return pathMatch[1];

    // query 기반
    const queryCandidates = ["articleNo", "nttId", "nttNo", "no", "idx"];
    for (const key of queryCandidates) {
      const value = u.searchParams.get(key);
      if (value && /^\d+$/.test(value)) return value;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * fallback ID: 제목+게시일 해시.
 *
 * 주의: 제목의 한 글자(띄어쓰기 포함)가 바뀌면 다른 ID가 된다.
 * 가능하면 `extractStableKey`를 우선 사용한다.
 */
export function hashFallback(title: string, postedAt: string): string {
  return crypto
    .createHash("sha256")
    .update(`${title.trim()}|${postedAt}`)
    .digest("hex")
    .slice(0, 12);
}

/**
 * 완성된 Notice ID 빌드. 형식: `<source>:<stable-key>`
 */
export function buildNoticeId(
  source: string,
  url: string,
  title: string,
  postedAt: string,
): string {
  const key = extractStableKey(url) ?? hashFallback(title, postedAt);
  return `${source}:${key}`;
}
