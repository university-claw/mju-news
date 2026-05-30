import type { Pool } from "pg";
import type {
  CourseCatalogDiagnosticBucket,
  CourseCatalogDiagnosticSample,
  CourseCatalogDiagnostics,
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

function courseCatalogDepartmentSqlFilter(
  params: unknown[],
  department: string | undefined,
): string | undefined {
  if (!department) return undefined;
  const filters = courseCatalogDepartmentCandidates(department).map((candidate) => {
    params.push(candidate);
    const index = params.length;
    return [
      `e.department = $${index}`,
      `e.department LIKE $${index} || ' %'`,
      `$${index} LIKE e.department || ' %'`,
      `e.department LIKE '% ' || $${index}`,
    ].join(" OR ");
  });
  if (!filters.length) return undefined;
  return `(${filters.map((filter) => `(${filter})`).join(" OR ")} OR e.department ~ '^[0-9]{5} .+교양$')`;
}

function courseCatalogWhere(
  opts: ListCourseCatalogOpts,
  includeDepartment: boolean,
): { where: string[]; params: unknown[] } {
  const params: unknown[] = [opts.year, opts.termCode];
  const where = ["e.year = $1", "e.term_code = $2"];
  if (opts.category) {
    params.push(opts.category);
    where.push(`e.category = $${params.length}`);
  }
  if (includeDepartment) {
    const departmentFilter = courseCatalogDepartmentSqlFilter(params, opts.department);
    if (departmentFilter) where.push(departmentFilter);
  }
  return { where, params };
}

function countBucketFromEntries(
  items: CourseCatalogEntry[],
  field: "category" | "department",
): CourseCatalogDiagnosticBucket[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const raw = field === "category" ? item.category : item.department;
    const key = raw?.trim() || "(empty)";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .slice(0, field === "department" ? 12 : 20)
    .map(([key, count]) => ({ key, count }));
}

function diagnosticSampleFromEntry(
  entry: CourseCatalogEntry,
): CourseCatalogDiagnosticSample {
  return {
    courseTitle: entry.courseTitle,
    ...(entry.courseCode ? { courseCode: entry.courseCode } : {}),
    ...(entry.category ? { category: entry.category } : {}),
    ...(entry.categoryLabel ? { categoryLabel: entry.categoryLabel } : {}),
    ...(entry.department ? { department: entry.department } : {}),
    ...(entry.gradeLevel ? { gradeLevel: entry.gradeLevel } : {}),
    ...(entry.section ? { section: entry.section } : {}),
    ...(entry.professor ? { professor: entry.professor } : {}),
  };
}

function diagnosticSamplesFromEntries(
  items: CourseCatalogEntry[],
  limit = 8,
): CourseCatalogDiagnosticSample[] {
  return items.slice(0, limit).map(diagnosticSampleFromEntry);
}

async function countRows(
  pool: Pool,
  where: string[],
  params: unknown[],
): Promise<number> {
  const res = await pool.query(
    `SELECT COUNT(*) AS count FROM course_catalog_entries e WHERE ${where.join(" AND ")}`,
    params,
  );
  return Number(res.rows[0]?.count ?? 0);
}

async function countBuckets(
  pool: Pool,
  where: string[],
  params: unknown[],
  column: "category" | "department",
  limit: number,
): Promise<CourseCatalogDiagnosticBucket[]> {
  const res = await pool.query(
    `
      SELECT COALESCE(NULLIF(e.${column}, ''), '(empty)') AS key, COUNT(*) AS count
      FROM course_catalog_entries e
      WHERE ${where.join(" AND ")}
      GROUP BY key
      ORDER BY count DESC, key ASC
      LIMIT ${limit}
    `,
    params,
  );
  return res.rows.map((row) => ({
    key: String(row.key ?? "(empty)"),
    count: Number(row.count ?? 0),
  }));
}

async function sampleRows(
  pool: Pool,
  where: string[],
  params: unknown[],
  limit = 8,
): Promise<CourseCatalogDiagnosticSample[]> {
  const queryParams = [...params, limit];
  const limitParam = queryParams.length;
  const res = await pool.query(
    `
      SELECT
        e.course_title,
        e.course_code,
        e.category,
        e.category_label,
        e.department,
        e.grade_level,
        e.section,
        e.professor
      FROM course_catalog_entries e
      WHERE ${where.join(" AND ")}
      ORDER BY
        CASE WHEN e.category = 'major' THEN 0 ELSE 1 END,
        e.course_title ASC,
        e.course_code ASC NULLS LAST,
        e.section ASC NULLS LAST
      LIMIT $${limitParam}
    `,
    queryParams,
  );
  return res.rows.map((row) => ({
    courseTitle: String(row.course_title ?? ""),
    ...(row.course_code ? { courseCode: String(row.course_code) } : {}),
    ...(row.category ? { category: String(row.category) } : {}),
    ...(row.category_label ? { categoryLabel: String(row.category_label) } : {}),
    ...(row.department ? { department: String(row.department) } : {}),
    ...(row.grade_level ? { gradeLevel: String(row.grade_level) } : {}),
    ...(row.section ? { section: String(row.section) } : {}),
    ...(row.professor ? { professor: String(row.professor) } : {}),
  }));
}

function diagnosticStage(
  key: string,
  label: string,
  count: number,
  emptyMessage: string,
) {
  return {
    key,
    label,
    count,
    status: count > 0 ? "ok" as const : "empty" as const,
    ...(count > 0 ? {} : { message: emptyMessage }),
  };
}

function courseCatalogDiagnosticHints(args: {
  allTermCount: number;
  departmentMatchedCount: number;
  readerOutputCount: number;
  outputItems: CourseCatalogEntry[];
}): string[] {
  const hints: string[] = [];
  if (args.allTermCount === 0) {
    hints.push("해당 연도/학기 원자료가 DB에 없습니다. 개설강좌 수집/임포트 여부를 먼저 확인해야 합니다.");
    return hints;
  }
  if (args.departmentMatchedCount === 0) {
    hints.push("원자료는 있지만 학과 필터 후 0건입니다. 학과 코드/학과명 매칭 규칙을 확인해야 합니다.");
    return hints;
  }
  if (args.readerOutputCount === 0) {
    hints.push("학과 필터 raw row는 있지만 reader 출력이 0건입니다. 중복 제거나 출력 변환 단계를 확인해야 합니다.");
    return hints;
  }
  if (!args.outputItems.some((item) => item.category === "major")) {
    hints.push("reader 출력에 전공 category가 없습니다. 수집 분류값(category/category_label) 또는 전공 분류 규칙을 확인해야 합니다.");
  }
  if (!args.outputItems.some((item) => item.category !== "major")) {
    hints.push("reader 출력에 교양/선택 category가 없습니다. 공통 교양 학과 공유 필터와 분류 규칙을 확인해야 합니다.");
  }
  return hints;
}

export async function listCourseCatalogDiagnostics(
  pool: Pool,
  opts: ListCourseCatalogOpts,
  outputItems: CourseCatalogEntry[],
): Promise<CourseCatalogDiagnostics> {
  const allTerm = courseCatalogWhere(opts, false);
  const departmentMatched = courseCatalogWhere(opts, true);
  const [
    allTermCount,
    departmentMatchedCount,
    allTermCategoryCounts,
    departmentMatchedCategoryCounts,
    allTermDepartmentCounts,
    departmentMatchedDepartmentCounts,
    allTermSamples,
    departmentMatchedSamples,
  ] = await Promise.all([
    countRows(pool, allTerm.where, allTerm.params),
    countRows(pool, departmentMatched.where, departmentMatched.params),
    countBuckets(pool, allTerm.where, allTerm.params, "category", 20),
    countBuckets(pool, departmentMatched.where, departmentMatched.params, "category", 20),
    countBuckets(pool, allTerm.where, allTerm.params, "department", 12),
    countBuckets(pool, departmentMatched.where, departmentMatched.params, "department", 12),
    sampleRows(pool, allTerm.where, allTerm.params),
    sampleRows(pool, departmentMatched.where, departmentMatched.params),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    source: "database",
    scope: {
      year: opts.year,
      termCode: opts.termCode,
      ...(opts.category ? { category: opts.category } : {}),
      ...(opts.department ? { department: opts.department } : {}),
    },
    departmentCandidates: opts.department ? courseCatalogDepartmentCandidates(opts.department) : [],
    stages: [
      diagnosticStage("db.term.all", "DB 연도/학기 전체", allTermCount, "해당 연도/학기 원자료가 없습니다."),
      diagnosticStage("db.term.departmentMatched", "DB 학과 필터 후", departmentMatchedCount, "학과 필터 후 남는 원자료가 없습니다."),
      diagnosticStage("reader.output", "reader 출력", outputItems.length, "reader가 웹뷰로 넘길 강의가 없습니다."),
    ],
    categoryCounts: {
      allTerm: allTermCategoryCounts,
      departmentMatched: departmentMatchedCategoryCounts,
      readerOutput: countBucketFromEntries(outputItems, "category"),
    },
    departmentCounts: {
      allTerm: allTermDepartmentCounts,
      departmentMatched: departmentMatchedDepartmentCounts,
      readerOutput: countBucketFromEntries(outputItems, "department"),
    },
    samples: {
      allTerm: allTermSamples,
      departmentMatched: departmentMatchedSamples,
      readerOutput: diagnosticSamplesFromEntries(outputItems),
    },
    hints: courseCatalogDiagnosticHints({
      allTermCount,
      departmentMatchedCount,
      readerOutputCount: outputItems.length,
      outputItems,
    }),
  };
}

export async function listCourseCatalogEntries(
  pool: Pool,
  opts: ListCourseCatalogOpts,
): Promise<CourseCatalogEntry[]> {
  const { where, params } = courseCatalogWhere(opts, true);

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
