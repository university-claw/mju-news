import Table from "cli-table3";
import type {
  CafeteriaMenuEntry,
  DoctorResult,
  ListResult,
  NoticeDetail,
  NoticeSummary,
} from "../types.js";

/**
 * 데이터 종류별 터미널 테이블 렌더러.
 *
 * JSON이 레이어 간 계약이므로 table은 "사람이 터미널에서 돌려볼 때"의
 * 편의 기능이다. 필드 생략/축약이 있어도 OK.
 */
export function renderTable(data: unknown, kind?: string): string {
  switch (kind) {
    case "notices":
      return renderNotices(data as ListResult<NoticeSummary>);
    case "notice-detail":
      return renderNoticeDetail(data as NoticeDetail);
    case "cafeterias":
      return renderCafeterias(data as ListResult<CafeteriaMenuEntry>);
    case "doctor":
      return renderDoctor(data as DoctorResult);
    case "skills":
      return renderSkills(data);
    default:
      return JSON.stringify(data, null, 2);
  }
}

function renderNotices(result: ListResult<NoticeSummary>): string {
  const table = new Table({
    head: ["source", "publishedAt", "title", "attach/img"],
    colWidths: [14, 12, 56, 12],
    wordWrap: true,
  });
  for (const n of result.items) {
    table.push([
      n.source,
      n.publishedAt.slice(0, 10),
      truncate(n.title, 54),
      `${n.hasAttachments ? "A" : "-"}/${n.hasImages ? "I" : "-"}`,
    ]);
  }
  return `${table.toString()}\ntotal: ${result.total}`;
}

function renderNoticeDetail(n: NoticeDetail): string {
  const lines: string[] = [];
  lines.push(`[${n.source}] ${n.title}`);
  lines.push(`id:        ${n.id}`);
  lines.push(`published: ${n.publishedAt}`);
  lines.push(`url:       ${n.url}`);
  if (n.author) lines.push(`author:    ${n.author}`);
  if (n.categoryLabel) lines.push(`category:  ${n.categoryLabel}`);
  lines.push("");
  if (n.bodyText) {
    lines.push("── body ──");
    lines.push(n.bodyText);
    lines.push("");
  }
  if (n.attachments.length > 0) {
    lines.push(`── attachments (${n.attachments.length}) ──`);
    for (const a of n.attachments) {
      lines.push(`• ${a.fileName}`);
      const ex = a.extraction;
      if (ex?.status === "succeeded" && ex.text) {
        lines.push(`  [${ex.extractorType}] ${truncate(ex.text, 200)}`);
      } else if (ex) {
        lines.push(`  [${ex.status}] ${ex.error ?? ""}`);
      }
    }
    lines.push("");
  }
  if (n.images.length > 0) {
    lines.push(`── images (${n.images.length}) ──`);
    for (const im of n.images) {
      const ocr = im.ocr;
      if (ocr?.status === "succeeded" && ocr.text) {
        lines.push(`• ocr: ${truncate(ocr.text, 160)}`);
      } else if (ocr) {
        lines.push(`• ocr: [${ocr.status}] ${ocr.error ?? ""}`);
      }
    }
  }
  return lines.join("\n");
}

function renderCafeterias(result: ListResult<CafeteriaMenuEntry>): string {
  const table = new Table({
    head: ["date", "cafeteria", "meal", "menu"],
    colWidths: [12, 14, 10, 64],
    wordWrap: true,
  });
  for (const e of result.items) {
    table.push([
      e.serviceDate,
      e.sourceName,
      e.mealType,
      e.isClosed ? "(휴무)" : truncate(e.menuText, 62),
    ]);
  }
  return `${table.toString()}\ntotal: ${result.total}`;
}

function renderDoctor(result: DoctorResult): string {
  const lines: string[] = [];
  lines.push(`node:       ${result.node.version}`);
  lines.push(
    `database:   ${result.database.connected ? "OK" : "FAIL"} ${result.database.host}:${result.database.port}/${result.database.database} (schema=${result.database.schema})`,
  );
  if (result.database.error) lines.push(`  error: ${result.database.error}`);
  lines.push("read-model:");
  lines.push(
    `  notice_items:           ${result.readModel.noticeItems} (latest: ${result.readModel.noticeItemsLatestAt ?? "none"})`,
  );
  lines.push(
    `  cafeteria_menu_entries: ${result.readModel.cafeteriaMenuEntries} (latest: ${result.readModel.cafeteriaMenuEntriesLatestDate ?? "none"})`,
  );
  lines.push("skills:");
  for (const sk of result.skills) {
    lines.push(`  ${sk.name}: ${sk.valid ? "OK" : "FAIL"}`);
    if (sk.error) lines.push(`    error: ${sk.error}`);
  }
  lines.push(`overall:    ${result.ok ? "OK" : "FAIL"}`);
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
