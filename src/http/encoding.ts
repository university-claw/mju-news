import iconv from "iconv-lite";

/**
 * Buffer를 주어진 인코딩으로 디코딩. iconv-lite가 지원하지 않는 인코딩은
 * UTF-8로 fallback.
 */
export function decodeHtml(buffer: Buffer, charset?: string): string {
  const cs = (charset ?? "utf-8").toLowerCase();
  if (cs === "utf-8" || cs === "utf8") return buffer.toString("utf-8");
  if (iconv.encodingExists(cs)) return iconv.decode(buffer, cs);
  return buffer.toString("utf-8");
}
