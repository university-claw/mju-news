import { describe, expect, it } from "vitest";
import { listCourseCatalogEntries } from "../../src/db/course-catalog.js";

describe("listCourseCatalogEntries", () => {
  it("returns the shared course catalog JSON shape and preserves unknown category", async () => {
    const pool = {
      query: async (sql: string, params: unknown[]) => ({
        rows: [
          {
            year: 2026,
            term_code: "10",
            term_label: "2026-1",
            category: "unknown",
            category_label: "Unclassified",
            course_code: "KMA02101",
            curriculum_number: "02101",
            course_title: "Data Structures",
            grade_level: "2학년",
            section: "001",
            professor: "Kim",
            credit: "3.0",
            department: "Computer Engineering",
            campus: "yongin",
            meetings: [
              {
                rawTimeRange: "Mon 09:00~10:15",
                dayOfWeek: 1,
                dayLabel: "Mon",
                startTime: "09:00",
                endTime: "10:15",
                location: "Y5441",
                parseStatus: "parsed",
                warning: null,
              },
            ],
          },
        ],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      }),
    };

    const items = await listCourseCatalogEntries(pool as never, {
      year: 2026,
      termCode: "10",
    });

    expect(items).toEqual([
      {
        year: 2026,
        termCode: "10",
        termLabel: "2026-1",
        category: "unknown",
        categoryLabel: "Unclassified",
        courseCode: "KMA02101",
        curriculumNumber: "02101",
        courseTitle: "Data Structures",
        gradeLevel: "2학년",
        section: "001",
        professor: "Kim",
        credit: 3,
        department: "Computer Engineering",
        campus: "yongin",
        meetings: [
          {
            rawTimeRange: "Mon 09:00~10:15",
            dayOfWeek: 1,
            dayLabel: "Mon",
            startTime: "09:00",
            endTime: "10:15",
            location: "Y5441",
            parseStatus: "parsed",
            warning: null,
          },
        ],
      },
    ]);
  });

  it("adds an exact category filter when provided", async () => {
    const observed: { sql?: string; params?: unknown[] } = {};
    const pool = {
      query: async (sql: string, params: unknown[]) => {
        observed.sql = sql;
        observed.params = params;
        return {
          rows: [],
          rowCount: 0,
          command: "SELECT",
          oid: 0,
          fields: [],
        };
      },
    };

    const items = await listCourseCatalogEntries(pool as never, {
      year: 2026,
      termCode: "10",
      category: "liberal-arts",
    });

    expect(items).toEqual([]);
    expect(observed.params).toEqual([2026, "10", "liberal-arts"]);
    expect(observed.sql).toContain("e.category = $3");
  });

  it("adds a department label or code-prefix filter when provided", async () => {
    const observed: { sql?: string; params?: unknown[] } = {};
    const pool = {
      query: async (sql: string, params: unknown[]) => {
        observed.sql = sql;
        observed.params = params;
        return {
          rows: [],
          rowCount: 0,
          command: "SELECT",
          oid: 0,
          fields: [],
        };
      },
    };

    const items = await listCourseCatalogEntries(pool as never, {
      year: 2026,
      termCode: "10",
      category: "major",
      department: "15611",
    });

    expect(items).toEqual([]);
    expect(observed.params).toEqual([2026, "10", "major", "15611"]);
    expect(observed.sql).toContain("e.category = $3");
    expect(observed.sql).toContain("e.department = $4 OR e.department LIKE $4 || ' %'");
    expect(observed.sql).toContain("e.department ~ '^[0-9]{5} .+교양$'");
  });

  it("expands full MSI department labels into code, parent, and suffix filters", async () => {
    const observed: { sql?: string; params?: unknown[] } = {};
    const pool = {
      query: async (sql: string, params: unknown[]) => {
        observed.sql = sql;
        observed.params = params;
        return {
          rows: [],
          rowCount: 0,
          command: "SELECT",
          oid: 0,
          fields: [],
        };
      },
    };

    const items = await listCourseCatalogEntries(pool as never, {
      year: 2026,
      termCode: "10",
      department: "15611 컴퓨터정보통신공학부 컴퓨터공학전공",
    });

    expect(items).toEqual([]);
    expect(observed.params).toEqual([
      2026,
      "10",
      "15611 컴퓨터정보통신공학부 컴퓨터공학전공",
      "15611",
      "컴퓨터정보통신공학부 컴퓨터공학전공",
      "컴퓨터공학전공",
    ]);
    expect(observed.sql).toContain("$3 LIKE e.department || ' %'");
    expect(observed.sql).toContain("e.department LIKE '% ' || $6");
  });

  it("deduplicates repeated snapshots while preferring classified entries", async () => {
    const observed: { sql?: string; params?: unknown[] } = {};
    const pool = {
      query: async (sql: string, params: unknown[]) => {
        observed.sql = sql;
        observed.params = params;
        return {
          rows: [],
          rowCount: 0,
          command: "SELECT",
          oid: 0,
          fields: [],
        };
      },
    };

    await listCourseCatalogEntries(pool as never, {
      year: 2026,
      termCode: "10",
    });

    expect(observed.params).toEqual([2026, "10"]);
    expect(observed.sql).toContain("row_number() OVER");
    expect(observed.sql).toContain("CASE WHEN e.category = 'unknown' THEN 1 ELSE 0 END");
    expect(observed.sql).toContain("WHERE rn = 1");
  });

  it("normalizes malformed meeting entries without coercing course category", async () => {
    const pool = {
      query: async () => ({
        rows: [
          {
            year: 2026,
            term_code: "20",
            term_label: "2026-2",
            category: "major",
            category_label: "Major",
            course_code: null,
            curriculum_number: null,
            course_title: "Capstone",
            grade_level: null,
            section: null,
            professor: null,
            credit: null,
            department: null,
            campus: null,
            meetings: [{ rawTimeRange: "TBD", parseStatus: "pending" }],
          },
        ],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      }),
    };

    const items = await listCourseCatalogEntries(pool as never, {
      year: 2026,
      termCode: "20",
    });

    expect(items[0]?.category).toBe("major");
    expect(items[0]?.meetings).toEqual([
      {
        rawTimeRange: "TBD",
        dayOfWeek: null,
        dayLabel: null,
        startTime: null,
        endTime: null,
        location: null,
        parseStatus: "unparsed",
        warning: null,
      },
    ]);
  });
});
