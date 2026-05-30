import type { Pool } from "pg";
import type {
  CourseCatalogEntry,
  CourseCatalogMeeting,
  CourseCatalogMeetingParseStatus,
} from "../types.js";
import { courseCatalogDepartmentCandidates } from "../course-catalog-department.js";

export interface ListCourseCatalogOpts {
  year: number;
  termCode: string;
  category?: string;
  department?: string;
}

const PARSE_STATUSES: readonly CourseCatalogMeetingParseStatus[] = [
  "parsed",
  "partial",
  "unparsed",
];

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeParseStatus(
  value: unknown,
): CourseCatalogMeetingParseStatus {
  if (
    typeof value === "string" &&
    (PARSE_STATUSES as readonly string[]).includes(value)
  ) {
    return value as CourseCatalogMeetingParseStatus;
  }
  return "unparsed";
}

function rowMeetingsToOutput(value: unknown): CourseCatalogMeeting[] {
  if (!Array.isArray(value)) return [];
  return value.map((meeting) => {
    const record =
      meeting && typeof meeting === "object"
        ? (meeting as Record<string, unknown>)
        : {};
    return {
      rawTimeRange:
        typeof record.rawTimeRange === "string" ? record.rawTimeRange : "",
      dayOfWeek: nullableNumber(record.dayOfWeek),
      dayLabel: nullableString(record.dayLabel),
      startTime: nullableString(record.startTime),
      endTime: nullableString(record.endTime),
      location: nullableString(record.location),
      parseStatus: normalizeParseStatus(record.parseStatus),
      warning: nullableString(record.warning),
    };
  });
}

function rowToEntry(row: Record<string, unknown>): CourseCatalogEntry {
  return {
    year: Number(row.year),
    termCode: row.term_code as string,
    termLabel: row.term_label as string,
    category: row.category as string,
    categoryLabel: row.category_label as string,
    courseCode: (row.course_code as string | null) ?? null,
    curriculumNumber: (row.curriculum_number as string | null) ?? null,
    courseTitle: row.course_title as string,
    gradeLevel: (row.grade_level as string | null) ?? null,
    section: (row.section as string | null) ?? null,
    professor: (row.professor as string | null) ?? null,
    credit: row.credit != null ? Number(row.credit) : null,
    department: (row.department as string | null) ?? null,
    campus: (row.campus as string | null) ?? null,
    meetings: rowMeetingsToOutput(row.meetings),
  };
}

export async function listCourseCatalogEntries(
  pool: Pool,
  opts: ListCourseCatalogOpts,
): Promise<CourseCatalogEntry[]> {
  const params: unknown[] = [opts.year, opts.termCode];
  const where = ["e.year = $1", "e.term_code = $2"];
  if (opts.category) {
    params.push(opts.category);
    where.push(`e.category = $${params.length}`);
  }
  if (opts.department) {
    const filters = courseCatalogDepartmentCandidates(opts.department).map((candidate) => {
      params.push(candidate);
      const index = params.length;
      return [
        `e.department = $${index}`,
        `e.department LIKE $${index} || ' %'`,
        `$${index} LIKE e.department || ' %'`,
        `e.department LIKE '% ' || $${index}`,
      ].join(" OR ");
    });
    where.push(`(${filters.map((filter) => `(${filter})`).join(" OR ")} OR e.department ~ '^[0-9]{5} .+교양$')`);
  }

  const res = await pool.query(
    `
      WITH ranked_entries AS (
        SELECT
          e.year,
          e.term_code,
          e.term_label,
          e.category,
          e.category_label,
          e.course_code,
              e.curriculum_number,
              e.course_title,
              e.grade_level,
              e.section,
          e.professor,
          e.credit,
          e.department,
          e.campus,
          e.meetings,
          e.id,
          row_number() OVER (
            PARTITION BY
              e.year,
              e.term_code,
              COALESCE(e.course_code, ''),
              COALESCE(e.section, ''),
              e.course_title,
              COALESCE(e.professor, '')
            ORDER BY
              CASE WHEN e.category = 'unknown' THEN 1 ELSE 0 END,
              s.collected_at DESC,
              e.id DESC
          ) AS rn
        FROM course_catalog_entries e
        JOIN course_catalog_snapshots s ON s.id = e.snapshot_id
        WHERE ${where.join(" AND ")}
      )
      SELECT
        year,
        term_code,
        term_label,
        category,
        category_label,
        course_code,
        curriculum_number,
        course_title,
        grade_level,
        section,
        professor,
        credit,
        department,
        campus,
        meetings
      FROM ranked_entries
      WHERE rn = 1
      ORDER BY course_title ASC, course_code ASC NULLS LAST, section ASC NULLS LAST, id ASC
    `,
    params,
  );

  return res.rows.map(rowToEntry);
}
