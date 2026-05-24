import type { OutputFormat } from "../types.js";
import { renderTable } from "./table.js";

export type TableKind =
  | "notices"
  | "notice-detail"
  | "cafeterias"
  | "doctor"
  | "skills";

/**
 * 커맨드 결과를 stdout에 쓴다.
 * - `json`: 파싱 가능한 JSON envelope (agent가 소비).
 * - `table`: 사람이 터미널에서 볼 때의 편의 포맷.
 */
export function printData(
  data: unknown,
  format: OutputFormat,
  tableKind?: TableKind,
): void {
  if (format === "json") {
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
    return;
  }
  const text = renderTable(data, tableKind);
  process.stdout.write(`${text}\n`);
}

/** 디버그 로그 (stderr). `--verbose`일 때만. */
export function debugLog(message: string): void {
  process.stderr.write(`[mju-news] ${message}\n`);
}
