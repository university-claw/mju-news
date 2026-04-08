import type { OutputFormat } from "../types.js";
import { renderTable } from "./table.js";

/**
 * 커맨드 결과를 stdout에 쓴다.
 *
 * - `json`: `JSON.stringify(data, null, 2)` 그대로. mju-server가 파싱한다.
 * - `table`: 사람이 읽기 위한 포맷. 커맨드별로 renderer가 다르므로
 *   `tableKind` 힌트로 분기한다.
 */
export function printData(
  data: unknown,
  format: OutputFormat,
  tableKind?: "notices" | "scrape" | "doctor" | "skills",
): void {
  if (format === "json") {
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
    return;
  }
  const text = renderTable(data, tableKind);
  process.stdout.write(`${text}\n`);
}

/** 디버그 로그 (stderr). `--verbose` 일 때만 호출되게 감싸서 쓴다. */
export function debugLog(message: string): void {
  process.stderr.write(`[mju-news] ${message}\n`);
}
