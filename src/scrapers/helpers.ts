/**
 * 스크래퍼 공통 헬퍼.
 *
 * 날짜/제목/URL을 정규화하는 순수 함수만 모아둔다.
 * 사이트 구조 파싱은 각 스크래퍼 본체에서 한다.
 */

/**
 * 한국 게시판 날짜 문자열을 ISO 8601 UTC로 변환한다.
 *
 * 지원 포맷:
 *  - "2026.04.08", "2026-04-08", "2026/04/08"
 *  - "2026.04.08 14:30", "2026-04-08 14:30:00"
 *  - "26.04.08" (YY.MM.DD — 2000년대로 해석)
 *
 * 시간이 없으면 `00:00:00`으로, 시간대가 없으면 KST(+09:00)로 해석 후
 * UTC로 변환해 반환. 실패 시 현재 시각을 반환하지 않고 예외를 던진다 —
 * "파싱 실패"를 "오늘 게시됨"으로 위장하면 중복 제거가 깨지기 때문.
 */
export function parseKoreanDate(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("empty date string");

  // 숫자만 추출
  const m = /^(\d{2,4})[.\-/](\d{1,2})[.\-/](\d{1,2})(?:[\sT](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/.exec(
    trimmed,
  );
  if (!m) {
    throw new Error(`unrecognized date format: "${trimmed}"`);
  }

  let yearStr = m[1] ?? "";
  const monthStr = m[2] ?? "";
  const dayStr = m[3] ?? "";
  const hourStr = m[4] ?? "0";
  const minStr = m[5] ?? "0";
  const secStr = m[6] ?? "0";

  let year = Number(yearStr);
  if (yearStr.length === 2) {
    // YY → 20YY (2000~2099)
    year += 2000;
  }
  const month = Number(monthStr);
  const day = Number(dayStr);
  const hour = Number(hourStr);
  const minute = Number(minStr);
  const second = Number(secStr);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    throw new Error(`invalid date values: "${trimmed}"`);
  }

  // KST (+09:00)로 해석 후 UTC로 변환.
  // Date.UTC는 UTC 기준이므로 9시간 빼줌.
  const kstEpochMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const utcMs = kstEpochMs - 9 * 60 * 60 * 1000;
  return new Date(utcMs).toISOString();
}

/**
 * 명지대 게시판의 onclick 핸들러에서 articleNo를 추출한다.
 *
 * 예: `jf_viewArtcl('mjukr','141','230921','t')` → "230921"
 */
export function extractArticleNoFromOnclick(
  onclick: string | undefined,
): string | null {
  if (!onclick) return null;
  const m = /jf_viewArtcl\s*\(\s*['"][^'"]+['"]\s*,\s*['"](\d+)['"]\s*,\s*['"](\d+)['"]/.exec(
    onclick,
  );
  return m?.[2] ?? null;
}

/**
 * 명지대 상세 URL 빌더.
 * menu/bbs 번호 + articleNo로 상세 페이지 URL 생성.
 *
 * 패턴: `https://www.mju.ac.kr/bbs/<site>/<bbsId>/<articleNo>/artclView.do`
 */
export function buildArticleDetailUrl(
  origin: string,
  site: string,
  bbsId: string,
  articleNo: string,
): string {
  return `${origin}/bbs/${site}/${bbsId}/${articleNo}/artclView.do`;
}

/** 여러 공백/개행 정리. */
export function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}
