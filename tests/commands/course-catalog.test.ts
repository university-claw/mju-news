import { describe, expect, it } from "vitest";
import {
  buildCourseCatalogDiagnosticsFromExport,
  buildCourseCatalogListResult,
  listCourseCatalogEntriesFromExport,
  parseCatalogYear,
  resolveCatalogJsonPath,
  validateCatalogCategory,
  validateCatalogDepartment,
  validateTermCode,
} from "../../src/commands/course-catalog.js";
import { buildRootCommand } from "../../src/commands/root.js";
import { InputError } from "../../src/errors.js";

describe("course-catalog command validation", () => {
  it("accepts valid year, term code, and unknown category", () => {
    expect(parseCatalogYear("2026")).toBe(2026);
    expect(validateTermCode("10")).toBe("10");
    expect(validateCatalogCategory("unknown")).toBe("unknown");
    expect(validateCatalogDepartment("  15611   Computer Engineering ")).toBe(
      "15611 Computer Engineering",
    );
  });

  it("rejects invalid year, term code, category, and department inputs", () => {
    expect(() => parseCatalogYear("99")).toThrow(InputError);
    expect(() => validateTermCode("spring 2026")).toThrow(InputError);
    expect(() => validateCatalogCategory("major;drop")).toThrow(InputError);
    expect(() => validateCatalogDepartment(" ")).toThrow(InputError);
  });

  it("keeps course-catalog query context in list output", () => {
    const result = buildCourseCatalogListResult([], {
      year: 2026,
      termCode: "10",
      category: "major",
      department: "15611",
    });

    expect(result).toEqual({
      total: 0,
      items: [],
      query: {
        year: 2026,
        termCode: "10",
        category: "major",
        department: "15611",
      },
    });
  });

  it("uses only an explicit catalog JSON path for the local smoke bypass", () => {
    expect(resolveCatalogJsonPath(" explicit.json ")).toBe("explicit.json");
    expect(resolveCatalogJsonPath(undefined)).toBeUndefined();
  });

  it("lists entries from a worker export JSON snapshot without database access", () => {
    const items = listCourseCatalogEntriesFromExport([
      {
        year: 2026,
        termCode: "10",
        termLabel: "1학기",
        entries: [
          {
            courseTitle: "AI프로그래밍",
            courseCode: "CSE401",
            section: "0601",
            professor: "김교수",
            category: "unknown",
            categoryLabel: "미분류",
            department: "15611 컴퓨터정보통신공학부 컴퓨터공학전공",
            credit: "3",
            meetings: [{ rawTimeRange: "월 09:00~10:50 (Y5441)", dayOfWeek: 1, startTime: "09:00", endTime: "10:50", location: "Y5441", parseStatus: "parsed" }],
          },
          {
            courseTitle: "AI프로그래밍",
            courseCode: "CSE401",
            section: "0601",
            professor: "김교수",
            category: "major",
            categoryLabel: "전공",
            department: "15611 컴퓨터정보통신공학부 컴퓨터공학전공",
            credit: 3,
            meetings: [{ rawTimeRange: "월 09:00~10:50 (Y5441)", dayOfWeek: 1, startTime: "09:00", endTime: "10:50", location: "Y5441", parseStatus: "parsed" }],
          },
          {
            courseTitle: "다른학과",
            category: "major",
            department: "15612 컴퓨터정보통신공학부 정보통신공학전공",
            meetings: [],
          },
          {
            courseTitle: "성서와인간이해",
            category: "elective",
            categoryLabel: "공통교양",
            department: "10000 자연캠퍼스 교양",
            credit: 2,
            meetings: [],
          },
        ],
      },
    ], {
      year: 2026,
      termCode: "10",
      department: "15611",
    });

    expect(items).toHaveLength(2);
    expect(items.find((item) => item.courseTitle === "AI프로그래밍")).toMatchObject({
      courseTitle: "AI프로그래밍",
      category: "major",
      categoryLabel: "전공",
      credit: 3,
      department: "15611 컴퓨터정보통신공학부 컴퓨터공학전공",
    });
    expect(items.find((item) => item.courseTitle === "AI프로그래밍")?.meetings[0]).toMatchObject({
      startTime: "09:00",
      endTime: "10:50",
      location: "Y5441",
      parseStatus: "parsed",
    });
    expect(items.find((item) => item.courseTitle === "성서와인간이해")).toMatchObject({
      category: "elective",
      categoryLabel: "공통교양",
    });
  });

  it("matches full MSI department labels against catalog code, parent, suffix, and shared liberal buckets", () => {
    const items = listCourseCatalogEntriesFromExport([
      {
        year: 2026,
        termCode: "10",
        entries: [
          {
            courseTitle: "Suffix major",
            category: "major",
            department: "컴퓨터공학전공",
            meetings: [],
          },
          {
            courseTitle: "Parent major",
            category: "major",
            department: "15611 컴퓨터정보통신공학부",
            meetings: [],
          },
          {
            courseTitle: "Code major",
            category: "major",
            department: "15611",
            meetings: [],
          },
          {
            courseTitle: "Other major",
            category: "major",
            department: "15612 컴퓨터정보통신공학부 정보통신공학전공",
            meetings: [],
          },
          {
            courseTitle: "Shared liberal",
            category: "elective",
            department: "10000 자연캠퍼스 교양",
            meetings: [],
          },
        ],
      },
    ], {
      year: 2026,
      termCode: "10",
      department: "15611 컴퓨터정보통신공학부 컴퓨터공학전공",
    });

    expect(new Set(items.map((item) => item.courseTitle))).toEqual(new Set([
      "Code major",
      "Parent major",
      "Shared liberal",
      "Suffix major",
    ]));
  });

  it("builds export diagnostics for catalog filtering stages", () => {
    const snapshot = [
      {
        year: 2026,
        termCode: "10",
        entries: [
          {
            courseTitle: "Major Course",
            category: "major",
            department: "15611 Computer Engineering",
            meetings: [],
          },
          {
            courseTitle: "Other Department",
            category: "major",
            department: "15612 Information Engineering",
            meetings: [],
          },
          {
            courseTitle: "Unknown Course",
            category: "unknown",
            department: "15611 Computer Engineering",
            meetings: [],
          },
        ],
      },
    ];
    const query = {
      year: 2026,
      termCode: "10",
      department: "15611",
    };
    const items = listCourseCatalogEntriesFromExport(snapshot, query);
    const diagnostics = buildCourseCatalogDiagnosticsFromExport(snapshot, query, items);

    expect(diagnostics.source).toBe("export");
    expect(diagnostics.stages.map((stage) => [stage.key, stage.count])).toEqual([
      ["export.term.all", 3],
      ["export.term.departmentMatched", 2],
      ["reader.output", 2],
    ]);
    expect(diagnostics.categoryCounts.readerOutput).toEqual([
      { key: "major", count: 1 },
      { key: "unknown", count: 1 },
    ]);
    expect(diagnostics.departmentCandidates).toEqual(["15611"]);
  });

  it("attaches the course-catalog group to the root command", () => {
    const root = buildRootCommand();
    expect(root.commands.map((command) => command.name())).toContain(
      "course-catalog",
    );
  });
});
