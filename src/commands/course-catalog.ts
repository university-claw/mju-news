import { readFile } from "node:fs/promises";
import { Command } from "commander";
import { closePool, getPool } from "../db/client.js";
import { listCourseCatalogEntries } from "../db/course-catalog.js";
import { courseCatalogDepartmentMatches } from "../course-catalog-department.js";
import { InputError } from "../errors.js";
import { printData } from "../output/print.js";
import type { CourseCatalogEntry, ListResult } from "../types.js";
import { readGlobalOptions } from "./common.js";

export interface CourseCatalogListQuery {
  year: number;
  termCode: string;
  category?: string;
  department?: string;
}

export function parseCatalogYear(input: string): number {
  const year = Number(input);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new InputError(`--year must be a four-digit year (got "${input}")`);
  }
  return year;
}

export function validateTermCode(input: string): string {
  const value = input.trim();
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(value)) {
    throw new InputError(
      `--term-code must be 1-32 letters, numbers, "_" or "-" (got "${input}")`,
    );
  }
  return value;
}

export function validateCatalogCategory(
  input: string | undefined,
): string | undefined {
  if (!input) return undefined;
  const value = input.trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
    throw new InputError(
      `--category must be 1-64 letters, numbers, "_" or "-" (got "${input}")`,
    );
  }
  return value;
}

export function validateCatalogDepartment(
  input: string | undefined,
): string | undefined {
  if (!input) return undefined;
  const value = input.replace(/\s+/gu, " ").trim();
  if (!value || value.length > 120) {
    throw new InputError(
      `--department must be 1-120 characters (got "${input}")`,
    );
  }
  return value;
}

export function resolveCatalogJsonPath(
  input: string | undefined,
): string | undefined {
  const explicit = input?.trim();
  if (explicit) return explicit;
  return undefined;
}

export function buildCourseCatalogListResult(
  items: CourseCatalogEntry[],
  query: CourseCatalogListQuery,
): ListResult<CourseCatalogEntry> {
  return {
    total: items.length,
    items,
    query: {
      year: query.year,
      termCode: query.termCode,
      ...(query.category ? { category: query.category } : {}),
      ...(query.department ? { department: query.department } : {}),
    },
  };
}

export function listCourseCatalogEntriesFromExport(
  courseCatalog: unknown,
  query: CourseCatalogListQuery,
): CourseCatalogEntry[] {
  const snapshots = Array.isArray(courseCatalog) ? courseCatalog : [courseCatalog];
  const byKey = new Map<string, CourseCatalogEntry>();
  for (const snapshot of snapshots) {
    const snapshotRecord = recordFrom(snapshot);
    const entries = Array.isArray(snapshotRecord.entries) ? snapshotRecord.entries : [];
    for (const rawEntry of entries) {
      const entry = courseCatalogEntryFromExport(rawEntry, snapshotRecord);
      if (!entry) continue;
      if (entry.year !== query.year || entry.termCode !== query.termCode) continue;
      if (query.category && entry.category !== query.category) continue;
      if (query.department && !courseCatalogDepartmentMatches(entry.department, query.department)) continue;
      const key = courseCatalogDedupKey(entry);
      const existing = byKey.get(key);
      if (!existing || courseCatalogEntryRank(entry) < courseCatalogEntryRank(existing)) {
        byKey.set(key, entry);
      }
    }
  }
  return [...byKey.values()].sort(compareCourseCatalogEntries);
}

function courseCatalogEntryFromExport(
  value: unknown,
  snapshot: Record<string, unknown>,
): CourseCatalogEntry | undefined {
  const record = recordFrom(value);
  const year = numberValue(record.year ?? snapshot.year);
  const termCode = stringValue(record.termCode ?? record.term_code ?? snapshot.termCode ?? snapshot.term_code);
  const courseTitle = stringValue(record.courseTitle ?? record.course_title ?? record.title);
  if (year == null || !termCode || !courseTitle) return undefined;
  return {
    year,
    termCode,
    termLabel: stringValue(record.termLabel ?? record.term_label ?? snapshot.termLabel ?? snapshot.term_label),
    category: stringValue(record.category),
    categoryLabel: stringValue(record.categoryLabel ?? record.category_label),
    courseCode: nullableString(record.courseCode ?? record.course_code),
    curriculumNumber: nullableString(record.curriculumNumber ?? record.curriculum_number),
    courseTitle,
    gradeLevel: nullableString(record.gradeLevel ?? record.grade_level ?? record.grade),
    section: nullableString(record.section),
    professor: nullableString(record.professor),
    credit: nullableNumber(record.credit ?? record.credits),
    department: nullableString(record.department),
    campus: nullableString(record.campus),
    meetings: courseCatalogMeetingsFromExport(record.meetings),
  };
}

function courseCatalogMeetingsFromExport(value: unknown): CourseCatalogEntry["meetings"] {
  if (!Array.isArray(value)) return [];
  return value.map((meeting) => {
    const record = recordFrom(meeting);
    return {
      rawTimeRange: stringValue(record.rawTimeRange ?? record.raw_time_range),
      dayOfWeek: nullableNumber(record.dayOfWeek ?? record.day_of_week),
      dayLabel: nullableString(record.dayLabel ?? record.day_label),
      startTime: nullableString(record.startTime ?? record.start_time),
      endTime: nullableString(record.endTime ?? record.end_time),
      location: nullableString(record.location),
      parseStatus: courseCatalogParseStatus(record.parseStatus ?? record.parse_status),
      warning: nullableString(record.warning),
    };
  });
}

function courseCatalogParseStatus(value: unknown): CourseCatalogEntry["meetings"][number]["parseStatus"] {
  return value === "parsed" || value === "partial" || value === "unparsed" ? value : "unparsed";
}

function courseCatalogDedupKey(entry: CourseCatalogEntry): string {
  return [
    entry.year,
    entry.termCode,
    entry.courseCode ?? "",
    entry.section ?? "",
    entry.courseTitle,
    entry.professor ?? "",
  ].join("\u0000");
}

function courseCatalogEntryRank(entry: CourseCatalogEntry): number {
  return entry.category === "unknown" ? 1 : 0;
}

function compareCourseCatalogEntries(a: CourseCatalogEntry, b: CourseCatalogEntry): number {
  return a.courseTitle.localeCompare(b.courseTitle, "ko") ||
    (a.courseCode ?? "").localeCompare(b.courseCode ?? "", "ko") ||
    (a.section ?? "").localeCompare(b.section ?? "", "ko");
}

async function readJson(pathname: string): Promise<unknown> {
  return JSON.parse(await readFile(pathname, "utf8"));
}

function recordFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown): string {
  if (typeof value === "string") return value.replace(/\s+/gu, " ").trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function nullableString(value: unknown): string | null {
  const text = stringValue(value);
  return text || null;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function nullableNumber(value: unknown): number | null {
  return numberValue(value) ?? null;
}

function buildList(): Command {
  return new Command("list")
    .description("MSI offered-course catalog for a term")
    .requiredOption("--year <year>", "catalog year, for example 2026")
    .requiredOption("--term-code <code>", "term code from worker catalog")
    .option("--category <category>", "optional exact category filter")
    .option("--department <department>", "optional exact department label or MSI department code prefix")
    .option("--catalog-json <path>", "locally generated catalog JSON; explicitly bypasses the database for smoke views")
    .action(async (_args, cmd: Command) => {
      const g = readGlobalOptions(cmd);
      const opts = cmd.opts<{
        year: string;
        termCode: string;
        category?: string;
        department?: string;
        catalogJson?: string;
      }>();
      const year = parseCatalogYear(opts.year);
      const termCode = validateTermCode(opts.termCode);
      const category = validateCatalogCategory(opts.category);
      const department = validateCatalogDepartment(opts.department);
      const catalogJson = resolveCatalogJsonPath(opts.catalogJson);
      const query = {
        year,
        termCode,
        ...(category ? { category } : {}),
        ...(department ? { department } : {}),
      };

      if (catalogJson) {
        const items = listCourseCatalogEntriesFromExport(await readJson(catalogJson), query);
        printData(buildCourseCatalogListResult(items, query), g.format, "course-catalog");
        return;
      }

      const pool = getPool();
      try {
        const items = await listCourseCatalogEntries(pool, query);
        const result = buildCourseCatalogListResult(items, query);
        printData(result, g.format, "course-catalog");
      } finally {
        await closePool();
      }
    });
}

export function buildCourseCatalogCommand(): Command {
  const cmd = new Command("course-catalog").description(
    "MSI offered-course catalog read model",
  );
  cmd.addCommand(buildList());
  return cmd;
}
