import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  buildAcademicPlanningGraduationRoadmapResult,
  buildAcademicPlanningTimetableResult,
  buildRequirementChoiceGroupsFromSources,
  normalizeCompletedCoursesFromMsi,
} from "../../src/commands/academic-planning.js";
import { buildRootCommand } from "../../src/commands/root.js";
import type { GraduationRequirementSource } from "../../src/types.js";

async function withTempDir<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "mju-academic-planning-"));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const officialSources: GraduationRequirementSource[] = [
  {
    id: 1,
    department: "전체 학부(과)",
    admissionYear: 2023,
    sourceKind: "department_page",
    sourceTitle: "명지대학교 방목기초교육대학 공통교양",
    sourceUrl: "https://www.mju.ac.kr/bangmok/1649/subview.do",
    sourcePublishedAt: null,
    sourceRetrievedAt: "2026-05-27T00:00:00.000Z",
    rules: [
      {
        requirementKey: "common-liberal-english",
        label: "공통교양 언어(영어)",
        category: "공통교양",
        requiredCredits: null,
        requiredCourseCodes: [],
        requiredCourseTitles: [],
        courseGroups: [
          {
            groupKey: "english-basic",
            label: "영어 기본",
            requiredCredits: 4,
            minCourses: 2,
            requiredCourseCodes: [],
            requiredCourseTitles: ["영어1", "영어2"],
            groupType: "alternative",
            alternativeGroup: "english-sequence",
            note: "영어1, 영어2 이수",
          },
          {
            groupKey: "english-advanced",
            label: "영어 심화",
            requiredCredits: 4,
            minCourses: 2,
            requiredCourseCodes: [],
            requiredCourseTitles: ["영어3", "영어4"],
            groupType: "alternative",
            alternativeGroup: "english-sequence",
            note: "영어3, 영어4 이수",
          },
          {
            groupKey: "plain-required",
            label: "필수",
            requiredCredits: 3,
            minCourses: 1,
            requiredCourseCodes: [],
            requiredCourseTitles: ["글쓰기"],
            groupType: null,
            alternativeGroup: null,
            note: null,
          },
        ],
        programTrack: null,
        minCourses: null,
        appliesTo: {},
        status: "confirmed",
        note: null,
      },
      {
        requirementKey: "science-choice",
        label: "학문기초교양",
        category: "학문기초교양",
        requiredCredits: null,
        requiredCourseCodes: [],
        requiredCourseTitles: [],
        courseGroups: [
          {
            groupKey: "science",
            label: "과학",
            requiredCredits: 3,
            minCourses: 1,
            requiredCourseCodes: [],
            requiredCourseTitles: ["물리학1", "일반화학"],
            groupType: "choice",
            alternativeGroup: null,
            note: "둘 중 택1",
          },
        ],
        programTrack: null,
        minCourses: null,
        appliesTo: {},
        status: "confirmed",
        note: null,
      },
    ],
  },
];

describe("academic-planning command", () => {
  it("attaches the academic-planning group to the root command", () => {
    const root = buildRootCommand();
    expect(root.commands.map((command) => command.name())).toContain("academic-planning");
  });

  it("derives choices only from official alternative or choice course groups", () => {
    const groups = buildRequirementChoiceGroupsFromSources(officialSources);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      key: "common-liberal-english-english-sequence",
      label: "영어",
      sourceTitle: "명지대학교 방목기초교육대학 공통교양",
    });
    expect(groups[0].options.map((option) => option.label)).toEqual(["영어 기본", "영어 심화"]);
    expect(groups[1]).toMatchObject({ key: "science-choice-science", label: "과학" });
    expect(groups[1].options.map((option) => option.label)).toEqual(["물리학1", "일반화학"]);
  });

  it("groups official English and conversation tracks into one user choice", () => {
    const sources: GraduationRequirementSource[] = [{
      ...officialSources[0],
      rules: [{
        ...officialSources[0].rules[0],
        courseGroups: [
          {
            groupKey: "english-basic",
            label: "영어 기본",
            requiredCredits: 4,
            minCourses: 2,
            requiredCourseCodes: [],
            requiredCourseTitles: ["영어1", "영어2"],
            groupType: "alternative",
            alternativeGroup: "english-sequence",
            note: "영어1, 영어2 이수",
          },
          {
            groupKey: "english-advanced",
            label: "영어 심화",
            requiredCredits: 4,
            minCourses: 2,
            requiredCourseCodes: [],
            requiredCourseTitles: ["영어3", "영어4"],
            groupType: "alternative",
            alternativeGroup: "english-sequence",
            note: "영어3, 영어4 이수",
          },
          {
            groupKey: "conversation-basic",
            label: "영어회화 기본",
            requiredCredits: 2,
            minCourses: 2,
            requiredCourseCodes: [],
            requiredCourseTitles: ["영어회화1", "영어회화2"],
            groupType: "alternative",
            alternativeGroup: "conversation-sequence",
            note: "영어회화1, 영어회화2 이수",
          },
          {
            groupKey: "conversation-advanced",
            label: "영어회화 심화",
            requiredCredits: 2,
            minCourses: 2,
            requiredCourseCodes: [],
            requiredCourseTitles: ["영어회화3", "영어회화4"],
            groupType: "alternative",
            alternativeGroup: "conversation-sequence",
            note: "영어회화3, 영어회화4 이수",
          },
        ],
      }],
    }];

    const groups = buildRequirementChoiceGroupsFromSources(sources);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      label: "영어 및 영어회화",
      options: [
        {
          key: "english-conversation-basic",
          label: "영어 및 영어회화 1,2",
          courseTitles: ["영어1", "영어2", "영어회화1", "영어회화2"],
        },
        {
          key: "english-conversation-advanced",
          label: "영어 및 영어회화 3,4",
          courseTitles: ["영어3", "영어4", "영어회화3", "영어회화4"],
        },
      ],
    });
  });

  it("normalizes completed courses from MSI grade-history shapes", () => {
    expect(normalizeCompletedCoursesFromMsi({
      termRecords: [
        {
          termLabel: "2025 1학기",
          courses: [
            { courseTitle: "운영체제", courseCode: "CSE301", credits: 3, grade: "A0" },
          ],
        },
      ],
    })).toEqual([
      {
        courseTitle: "운영체제",
        courseCode: "CSE301",
        credits: 3,
        termLabel: "2025 1학기",
        grade: "A0",
      },
    ]);
  });

  it("normalizes MSI year-separated term rows and allRows fallback", () => {
    expect(normalizeCompletedCoursesFromMsi({
      termRecords: [
        {
          year: 2025,
          termLabel: "1\uD559\uAE30",
          courses: [
            { courseTitle: "Discrete Mathematics", courseCode: "KME02108", credits: 3 },
          ],
        },
      ],
      allRows: [
        {
          year: 2024,
          termLabel: "2\uD559\uAE30",
          courseTitle: "Linear Algebra",
          courseCode: "KME02107",
          credits: 3,
        },
      ],
    })).toEqual([
      {
        courseTitle: "Discrete Mathematics",
        courseCode: "KME02108",
        credits: 3,
        termLabel: "2025 1\uD559\uAE30",
      },
      {
        courseTitle: "Linear Algebra",
        courseCode: "KME02107",
        credits: 3,
        termLabel: "2024 2\uD559\uAE30",
      },
    ]);
  });

  it("builds a timetable planning payload from fixture catalog and requirement seeds", async () => {
    await withTempDir(async (dir) => {
      const catalogJson = join(dir, "catalog.json");
      const requirementsDir = join(dir, "requirements");
      const completedJson = join(dir, "grade-history.json");
      const personalJson = join(dir, "personal-msi.json");
      await writeFile(catalogJson, JSON.stringify({
        year: 2026,
        termCode: "10",
        entries: [
          {
            year: 2026,
            termCode: "10",
            courseTitle: "영어3",
            category: "elective",
            categoryLabel: "공통교양",
            department: "10000 자연캠퍼스 교양",
            meetings: [],
          },
          {
            year: 2026,
            termCode: "10",
            courseTitle: "AI프로그래밍",
            category: "major",
            categoryLabel: "전공",
            department: "15611 컴퓨터정보통신공학부 컴퓨터공학전공",
            meetings: [],
          },
        ],
      }), "utf8");
      await writeFile(completedJson, `\uFEFF${JSON.stringify({
        studentInfo: { 학과: "컴퓨터공학전공", 학년: "3" },
        termRecords: [{ termLabel: "2025 1학기", courses: [{ courseTitle: "자료구조", credits: 3 }] }],
      })}`, "utf8");
      await writeFile(personalJson, JSON.stringify({
        currentCourses: [{ courseTitle: "Capstone Design", credits: 3 }],
      }), "utf8");
      await import("node:fs/promises").then((fs) => fs.mkdir(requirementsDir));
      await writeFile(join(requirementsDir, "common.json"), JSON.stringify(officialSources[0]), "utf8");

      const result = await buildAcademicPlanningTimetableResult({
        year: 2026,
        termCode: "10",
        department: "15611",
        admissionYear: 2024,
        catalogJson,
        requirementsDir,
        personalMsiJson: personalJson,
        completedCoursesJson: completedJson,
      });

      expect(result.items.map((item) => item.courseTitle).sort()).toEqual(["AI프로그래밍", "영어3"]);
      expect(result.choiceGroups).toHaveLength(2);
      expect(result.departmentLabel).toBe("컴퓨터공학전공");
      expect(result.studentStanding).toBe("3학년 1학기");
      expect(result.completedCourses[0]).toMatchObject({ courseTitle: "자료구조" });
      expect(result.currentCourses[0]).toMatchObject({ courseTitle: "Capstone Design" });
      expect(result.dataReadiness).toEqual([
        expect.objectContaining({ target: "course-catalog", status: "ready", count: 2 }),
        expect.objectContaining({ target: "graduation-requirements", status: "ready", count: 1 }),
      ]);
      expect(result.officialRequirementCoverage.status).toBe("confirmed");
    });
  });

  it("preselects requirement choices from completed course evidence", async () => {
    await withTempDir(async (dir) => {
      const englishBasicTitles = officialSources[0].rules[0].courseGroups[0].requiredCourseTitles;
      const spacedEnglishTitle = englishBasicTitles[0]?.replace(/(\d)$/u, " $1") ?? englishBasicTitles[0];
      const catalogJson = join(dir, "catalog.json");
      const requirementsDir = join(dir, "requirements");
      const completedJson = join(dir, "grade-history.json");
      await writeFile(catalogJson, JSON.stringify({
        year: 2026,
        termCode: "10",
        entries: [{
          year: 2026,
          termCode: "10",
          courseTitle: "?곸뼱3",
          category: "elective",
          department: "10000 ?먯뿰罹좏띁??援먯뼇",
          meetings: [],
        }],
      }), "utf8");
      await import("node:fs/promises").then((fs) => fs.mkdir(requirementsDir));
      await writeFile(join(requirementsDir, "common.json"), JSON.stringify(officialSources[0]), "utf8");
      await writeFile(completedJson, JSON.stringify({
        completedCourses: [
          { courseTitle: spacedEnglishTitle, courseCode: "ENG101" },
          { courseTitle: englishBasicTitles[1], courseCode: "ENG102" },
        ],
      }), "utf8");

      const result = await buildAcademicPlanningTimetableResult({
        year: 2026,
        termCode: "10",
        department: "15611",
        admissionYear: 2024,
        catalogJson,
        requirementsDir,
        completedCoursesJson: completedJson,
      });

      const englishGroup = result.choiceGroups.find((group) =>
        group.options.some((option) => option.key === "english-basic"));
      expect(englishGroup).toBeTruthy();
      expect(result.selectedChoiceKeys[englishGroup!.key]).toBe("english-basic");
      expect(result.timetableSelectedChoiceKeys).toEqual(result.selectedChoiceKeys);
    });
  });

  it("keeps missing official coverage auditable without inventing choices", async () => {
    await withTempDir(async (dir) => {
      const requirementsDir = join(dir, "requirements");
      await import("node:fs/promises").then((fs) => fs.mkdir(requirementsDir));

      const result = await buildAcademicPlanningGraduationRoadmapResult({
        department: "19999 신규학과",
        admissionYear: 2025,
        requirementsDir,
      });

      expect(result.items).toEqual([]);
      expect(result.choiceGroups).toEqual([]);
      expect(result.dataReadiness).toEqual([
        expect.objectContaining({ target: "graduation-requirements", status: "empty", count: 0 }),
      ]);
      expect(result.dataReadiness[0].message).toContain("Verify public-data graduation requirement import");
      expect(result.officialRequirementCoverage).toMatchObject({
        status: "needs-official-check",
      });
      expect(result.query.unavailableReason).toContain("공식 졸업요건 데이터");
    });
  });
});
