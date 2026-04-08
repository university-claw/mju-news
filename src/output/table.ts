import Table from "cli-table3";
import type {
  DoctorResult,
  ListResult,
  Notice,
  ScrapeResult,
} from "../types.js";

/**
 * 데이터 종류별 터미널 테이블 렌더러.
 *
 * JSON이 레이어 간 계약이므로 table은 "사람이 터미널에서 돌려볼 때"의
 * 편의 기능이다. 필드 생략/축약이 있어도 OK — mju-server는 table을 쓰지 않는다.
 */
export function renderTable(data: unknown, kind?: string): string {
  switch (kind) {
    case "notices":
      return renderNotices(data as ListResult);
    case "scrape":
      return renderScrape(data as ScrapeResult);
    case "doctor":
      return renderDoctor(data as DoctorResult);
    case "skills":
      return renderSkills(data);
    default:
      // fallback: JSON 블록 (table 힌트가 없는데 table 요청한 경우)
      return JSON.stringify(data, null, 2);
  }
}

function renderNotices(result: ListResult): string {
  const table = new Table({
    head: ["source", "postedAt", "title", "url"],
    colWidths: [12, 12, 60, 40],
    wordWrap: true,
  });
  for (const n of result.items) {
    table.push([
      n.source,
      formatDate(n.postedAt),
      truncate(n.title, 58),
      truncate(n.url, 38),
    ]);
  }
  return `${table.toString()}\ntotal: ${result.total}`;
}

function renderScrape(result: ScrapeResult): string {
  const table = new Table({
    head: ["source", "fetched", "new", "error"],
    colWidths: [16, 10, 8, 40],
    wordWrap: true,
  });
  for (const [id, s] of Object.entries(result.sources)) {
    table.push([id, String(s.fetched), String(s.new), s.error ?? ""]);
  }
  return [
    table.toString(),
    `scrapedAt: ${result.scrapedAt}`,
    `totalNew:  ${result.totalNew}`,
    `totalStored: ${result.totalStored}`,
  ].join("\n");
}

function renderDoctor(result: DoctorResult): string {
  const lines: string[] = [];
  lines.push(
    `node:      ${result.node.version} ${result.node.ok ? "OK" : "FAIL"}`,
  );
  lines.push(
    `dataDir:   ${result.dataDir.path} ${result.dataDir.writable ? "OK" : "FAIL"}`,
  );
  lines.push("sources:");
  for (const [id, s] of Object.entries(result.sources)) {
    lines.push(`  ${id}: ${s.reachable ? "OK" : "FAIL"} (${s.url})`);
    if (s.error) lines.push(`    error: ${s.error}`);
  }
  lines.push("skills:");
  for (const sk of result.skills) {
    lines.push(`  ${sk.name}: ${sk.valid ? "OK" : "FAIL"}`);
    if (sk.error) lines.push(`    error: ${sk.error}`);
  }
  lines.push(`overall:   ${result.ok ? "OK" : "FAIL"}`);
  return lines.join("\n");
}

function renderSkills(data: unknown): string {
  if (!Array.isArray(data)) return JSON.stringify(data, null, 2);
  const table = new Table({
    head: ["name", "version", "path"],
    wordWrap: true,
  });
  for (const s of data as Array<{
    name: string;
    version?: string;
    path: string;
  }>) {
    table.push([s.name, s.version ?? "", s.path]);
  }
  return table.toString();
}

function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max - 1)}…`;
}

function formatDate(iso: string): string {
  // ISO → YYYY-MM-DD 까지만 표시
  return iso.slice(0, 10);
}

// 현재 타입에서 사용된다는 걸 컴파일러에게 알림 (Notice는 ListResult.items에 등장)
type _Notice = Notice;
