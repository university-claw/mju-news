import { describe, expect, it } from "vitest";
import {
  graduationDepartmentCandidates,
  listGraduationRequirementSources,
} from "../../src/db/graduation-requirements.js";

describe("listGraduationRequirementSources", () => {
  it("builds department aliases from MSI department labels", () => {
    expect(graduationDepartmentCandidates("15611 컴퓨터정보통신공학부 컴퓨터공학전공")).toEqual([
      "15611 컴퓨터정보통신공학부 컴퓨터공학전공",
      "컴퓨터정보통신공학부 컴퓨터공학전공",
      "컴퓨터공학전공",
      "2025학번 컴퓨터정보통신공학부 공통",
    ]);
    expect(graduationDepartmentCandidates("16460 사회복지학과 (야간)")).toEqual([
      "16460 사회복지학과 (야간)",
      "사회복지학과 (야간)",
      "사회복지학과",
      "2025학번 인문·사회·미디어·미래 공통",
      "2018-2024학번 인문·사회·미래 공통",
    ]);
    expect(graduationDepartmentCandidates("14421 인문콘텐츠학부 국어국문학전공")).toContain(
      "2025학번 인문·사회·미디어·미래 공통",
    );
    expect(graduationDepartmentCandidates("18032 건축학부 전통건축학전공")).toContain(
      "2025학번 전통건축전공 공통",
    );
    expect(graduationDepartmentCandidates("16490 법학과")).toEqual([
      "16490 법학과",
      "법학과",
      "2025학번 인문·사회·미디어·미래 공통",
      "2018-2024학번 법과 공통",
    ]);
    expect(graduationDepartmentCandidates("17320 스포츠산업경영학과")).not.toContain(
      "2018-2024학번 경영 공통",
    );
    expect(graduationDepartmentCandidates("18032 건축학부 전통건축학전공")).not.toContain(
      "2025학번 건축학전공·공간디자인 공통",
    );
    expect(graduationDepartmentCandidates("15650 반도체시스템공학과")).toContain(
      "반도체공학부",
    );
    expect(graduationDepartmentCandidates("19036 융합예술학융합전공")).toContain(
      "융합예술학",
    );
    expect(graduationDepartmentCandidates("15430 기계시스템공학부")).toContain(
      "2025학번 기계시스템공학부 공통",
    );
    expect(graduationDepartmentCandidates("15610 컴퓨터정보통신공학부")).toContain(
      "2025학번 컴퓨터정보통신공학부 공통",
    );
    expect(graduationDepartmentCandidates("15620 전기전자공학부")).toContain(
      "2025학번 전기전자공학부 공통",
    );
    expect(graduationDepartmentCandidates("18620 융합소프트웨어학부")).toContain(
      "2025학번 융합소프트웨어학부 공통",
    );
    expect(graduationDepartmentCandidates("18620 융합소프트웨어학부", 2024)).toContain(
      "2018-2024학번 융합소프트웨어학부 공통",
    );
    expect(graduationDepartmentCandidates("18620 융합소프트웨어학부", 2024)).not.toContain(
      "2025학번 융합소프트웨어학부 공통",
    );
    expect(graduationDepartmentCandidates("18620 융합소프트웨어학부", 2025)).not.toContain(
      "2018-2024학번 융합소프트웨어학부 공통",
    );
    expect(graduationDepartmentCandidates("16460 사회복지학과 (야간)", 2024)).toContain(
      "2018-2024학번 인문·사회·미래 공통",
    );
    expect(graduationDepartmentCandidates("16460 사회복지학과 (야간)", 2024)).not.toContain(
      "2025학번 인문·사회·미디어·미래 공통",
    );
    expect(graduationDepartmentCandidates("16460 사회복지학과 (야간)", 2025)).toContain(
      "2025학번 인문·사회·미디어·미래 공통",
    );
    expect(graduationDepartmentCandidates("16460 사회복지학과 (야간)", 2025)).not.toContain(
      "2018-2024학번 인문·사회·미래 공통",
    );
    expect(graduationDepartmentCandidates("15610 컴퓨터정보통신공학부", 2024)).not.toContain(
      "2025학번 컴퓨터정보통신공학부 공통",
    );
    expect(graduationDepartmentCandidates("15610 컴퓨터정보통신공학부", 2025)).toContain(
      "2025학번 컴퓨터정보통신공학부 공통",
    );
    expect(graduationDepartmentCandidates("15611 컴퓨터정보통신공학부 컴퓨터공학전공", 2025)).toContain(
      "2025학번 컴퓨터정보통신공학부 공통",
    );
    expect(graduationDepartmentCandidates("15612 컴퓨터정보통신공학부 정보통신공학전공", 2025)).toContain(
      "2025학번 컴퓨터정보통신공학부 공통",
    );
    expect(graduationDepartmentCandidates("15611 컴퓨터정보통신공학부 컴퓨터공학전공", 2024)).not.toContain(
      "2025학번 컴퓨터정보통신공학부 공통",
    );
    expect(graduationDepartmentCandidates("15411 화공신소재공학부 화학공학전공", 2025)).toContain(
      "2025학번 화공신소재공학부 공통",
    );
    expect(graduationDepartmentCandidates("15412 화공신소재공학부 신소재공학전공", 2025)).toContain(
      "2025학번 화공신소재공학부 공통",
    );
    expect(graduationDepartmentCandidates("15421 스마트인프라공학부 환경시스템공학전공", 2025)).toContain(
      "2025학번 스마트인프라공학부 환경시스템공학전공",
    );
    expect(graduationDepartmentCandidates("15422 스마트인프라공학부 건설환경공학전공", 2025)).toContain(
      "2025학번 스마트인프라공학부 건설환경공학전공",
    );
    expect(graduationDepartmentCandidates("15423 스마트인프라공학부 스마트모빌리티공학전공", 2025)).toContain(
      "2025학번 스마트모빌리티공학전공",
    );
    expect(graduationDepartmentCandidates("15431 기계시스템공학부 기계공학전공", 2025)).toContain(
      "2025학번 기계시스템공학부 공통",
    );
    expect(graduationDepartmentCandidates("15621 전기전자공학부 전기공학전공", 2025)).toContain(
      "2025학번 전기전자공학부 공통",
    );
    expect(graduationDepartmentCandidates("15622 전기전자공학부 전자공학전공", 2025)).toContain(
      "2025학번 전기전자공학부 공통",
    );
    expect(graduationDepartmentCandidates("18621 융합소프트웨어학부 응용소프트웨어전공", 2025)).toContain(
      "2025학번 융합소프트웨어학부 공통",
    );
    expect(graduationDepartmentCandidates("18622 융합소프트웨어학부 데이터사이언스전공", 2025)).toContain(
      "2025학번 융합소프트웨어학부 공통",
    );
    expect(graduationDepartmentCandidates("15630 산업경영공학과", 2025)).toContain(
      "2025학번 산업경영공학과",
    );
    expect(graduationDepartmentCandidates("15420 스마트인프라공학부", 2025)).not.toContain(
      "2025학번 스마트인프라공학부 건설환경공학전공",
    );
    expect(graduationDepartmentCandidates("15424 스마트인프라공학부 글로벌스마트인프라공학전공", 2025)).not.toContain(
      "2025학번 스마트모빌리티공학전공",
    );
    expect(graduationDepartmentCandidates("15424 스마트인프라공학부 글로벌스마트인프라공학전공", 2025)).toContain(
      "글로벌스마트인프라공학전공",
    );
    expect(graduationDepartmentCandidates("15440 스마트사회인프라유지관리학과", 2025)).toContain(
      "스마트사회인프라유지관리학과",
    );
    expect(graduationDepartmentCandidates("15440", 2025)).toContain(
      "스마트사회인프라유지관리학과",
    );
    expect(graduationDepartmentCandidates("15640", 2024)).toContain("반도체공학부");
    expect(graduationDepartmentCandidates("15808 물리학과", 2025)).toContain("물리학과");
    expect(graduationDepartmentCandidates("15808 물리학과", 2025)).not.toContain(
      "2018-2024학번 자연과학 공통",
    );
    expect(graduationDepartmentCandidates("15809 수학과", 2025)).toContain("수학과");
    expect(graduationDepartmentCandidates("15809 수학과", 2025)).not.toContain(
      "2018-2024학번 자연과학 공통",
    );
    expect(graduationDepartmentCandidates("18610", 2024)).toContain(
      "디지털콘텐츠디자인학과",
    );
  });

  it("returns official sources with normalized rules for a department and admission year", async () => {
    const observed: { sql?: string; params?: unknown[] } = {};
    const pool = {
      query: async (sql: string, params: unknown[]) => {
        observed.sql = sql;
        observed.params = params;
        return {
          rows: [
            {
              source_id: 3,
              department: "컴퓨터공학과",
              admission_year: 2022,
              source_kind: "msi_graduation",
              source_title: "MSI 졸업사정 조회",
              source_url: "mju-msi://graduation/computer-engineering/2022",
              source_published_at: null,
              source_retrieved_at: "2026-05-22T00:00:00.000Z",
              requirement_key: "major-credit",
              label: "전공 학점",
              category: "major",
              required_credits: "66.00",
              required_course_codes: [],
              required_course_titles: [],
              course_groups: [
                {
                  groupKey: "major-basic",
                  label: "전공기초",
                  minCourses: 1,
                  requiredCourseTitles: ["자료구조"],
                },
              ],
              program_track: "비인증",
              min_courses: 1,
              applies_to: { admissionYearFrom: 2018 },
              rule_status: "confirmed",
              note: null,
            },
          ],
          rowCount: 1,
          command: "SELECT",
          oid: 0,
          fields: [],
        };
      },
    };

    const items = await listGraduationRequirementSources(pool as never, {
      department: "컴퓨터공학과",
      admissionYear: 2022,
    });

    expect(observed.params?.[0]).toBe(2022);
    expect(observed.params?.[1]).toEqual(expect.arrayContaining([
      "컴퓨터공학과",
      "전체 학부(과)",
      "전체 학부",
      "전체 학과",
      "전체",
    ]));
    expect(observed.params?.[2]).toEqual(["컴퓨터공학과"]);
    expect(observed.sql).toContain("graduation_requirement_sources");
    expect(observed.sql).toContain("s.admission_year <= $1");
    expect(observed.sql).toContain("s.department = ANY($2::text[])");
    expect(observed.sql).toContain("s.department = ANY($3::text[])");
    expect(items).toEqual([
      {
        id: 3,
        department: "컴퓨터공학과",
        admissionYear: 2022,
        sourceKind: "msi_graduation",
        sourceTitle: "MSI 졸업사정 조회",
        sourceUrl: "mju-msi://graduation/computer-engineering/2022",
        sourcePublishedAt: null,
        sourceRetrievedAt: "2026-05-22T00:00:00.000Z",
        rules: [
          {
            requirementKey: "major-credit",
            label: "전공 학점",
            category: "major",
            requiredCredits: 66,
            requiredCourseCodes: [],
            requiredCourseTitles: [],
            courseGroups: [
              {
                groupKey: "major-basic",
                label: "전공기초",
                requiredCredits: null,
                minCourses: 1,
                requiredCourseCodes: [],
                requiredCourseTitles: ["자료구조"],
                groupType: null,
                alternativeGroup: null,
                note: null,
              },
            ],
            programTrack: "비인증",
            minCourses: 1,
            appliesTo: { admissionYearFrom: 2018 },
            status: "confirmed",
            note: null,
          },
        ],
      },
    ]);
  });

  it("matches short official seed departments from full MSI department labels", async () => {
    const observed: { params?: unknown[] } = {};
    const pool = {
      query: async (_sql: string, params: unknown[]) => {
        observed.params = params;
        return {
          rows: [
            {
              source_id: 4,
              department: "컴퓨터공학전공",
              admission_year: 2025,
              source_kind: "department_page",
              source_title: "컴퓨터공학전공 교과과정",
              source_url: "https://www.mju.ac.kr/mjukr/808/subview.do",
              source_published_at: null,
              source_retrieved_at: "2026-05-23T00:00:00.000Z",
              requirement_key: "major-credit",
              label: "전공",
              category: "전공",
              required_credits: "70.00",
              required_course_codes: [],
              required_course_titles: [],
              course_groups: [],
              program_track: "비인증",
              min_courses: null,
              applies_to: { admissionYearFrom: 2025 },
              rule_status: "confirmed",
              note: null,
            },
          ],
          rowCount: 1,
          command: "SELECT",
          oid: 0,
          fields: [],
        };
      },
    };

    const items = await listGraduationRequirementSources(pool as never, {
      department: "15611 컴퓨터정보통신공학부 컴퓨터공학전공",
      admissionYear: 2025,
    });

    expect(observed.params?.[1]).toEqual(expect.arrayContaining([
      "15611 컴퓨터정보통신공학부 컴퓨터공학전공",
      "컴퓨터정보통신공학부 컴퓨터공학전공",
      "컴퓨터공학전공",
    ]));
    expect(items[0]?.department).toBe("컴퓨터공학전공");
    expect(items[0]?.rules[0]?.requiredCredits).toBe(70);
  });

  it("can return department-specific and universal latest-effective sources together", async () => {
    const pool = {
      query: async () => ({
        rows: [
          {
            source_id: 7,
            department: "컴퓨터공학전공",
            admission_year: 2024,
            source_kind: "department_page",
            source_title: "컴퓨터공학전공 졸업이수가이드",
            source_url: "https://cs.mju.ac.kr/cs/10763/subview.do",
            source_published_at: null,
            source_retrieved_at: "2026-05-22T00:00:00.000Z",
            requirement_key: "major-credit",
            label: "전공",
            category: "전공",
            required_credits: "70.00",
            required_course_codes: [],
            required_course_titles: [],
            course_groups: [],
            program_track: "비인증",
            min_courses: null,
            applies_to: {},
            rule_status: "confirmed",
            note: null,
          },
          {
            source_id: 8,
            department: "전체 학부(과)",
            admission_year: 2023,
            source_kind: "department_page",
            source_title: "방목기초교육대학 공통교양",
            source_url: "https://www.mju.ac.kr/bangmok/1649/subview.do",
            source_published_at: null,
            source_retrieved_at: "2026-05-22T00:00:00.000Z",
            requirement_key: "common-liberal-english-2023-plus",
            label: "공통교양 언어(영어)",
            category: "공통교양",
            required_credits: null,
            required_course_codes: [],
            required_course_titles: [],
            course_groups: [
              {
                groupKey: "english-advanced",
                label: "영어 심화",
                minCourses: 2,
                requiredCourseTitles: ["영어3", "영어4"],
                groupType: "alternative",
                alternativeGroup: "english-sequence",
              },
            ],
            program_track: null,
            min_courses: null,
            applies_to: { admissionYearFrom: 2023 },
            rule_status: "confirmed",
            note: "2023학번 이후 전체 학부(과) 학생 공통 적용",
          },
        ],
        rowCount: 2,
        command: "SELECT",
        oid: 0,
        fields: [],
      }),
    };

    const items = await listGraduationRequirementSources(pool as never, {
      department: "컴퓨터공학전공",
      admissionYear: 2024,
    });

    expect(items.map((source) => source.department)).toEqual([
      "컴퓨터공학전공",
      "전체 학부(과)",
    ]);
    expect(items[1]?.admissionYear).toBe(2023);
    expect(items[1]?.rules[0]?.courseGroups[0]).toMatchObject({
      label: "영어 심화",
      requiredCourseTitles: ["영어3", "영어4"],
      alternativeGroup: "english-sequence",
    });
  });

  it("keeps only the latest applicable source cohort for the same department", async () => {
    const pool = {
      query: async () => ({
        rows: [
          {
            source_id: 71,
            department: "Computer Engineering",
            admission_year: 2024,
            source_kind: "department_page",
            source_title: "Computer Engineering 2024 requirements",
            source_url: "https://example.test/cse/2024",
            source_published_at: null,
            source_retrieved_at: "2026-05-22T00:00:00.000Z",
            requirement_key: "major-credit-2024",
            label: "Major",
            category: "Major",
            required_credits: "66.00",
            required_course_codes: [],
            required_course_titles: ["Legacy Systems"],
            course_groups: [],
            program_track: null,
            min_courses: null,
            applies_to: {},
            rule_status: "confirmed",
            note: null,
          },
          {
            source_id: 72,
            department: "Computer Engineering",
            admission_year: 2025,
            source_kind: "department_page",
            source_title: "Computer Engineering 2025 requirements",
            source_url: "https://example.test/cse/2025",
            source_published_at: null,
            source_retrieved_at: "2026-05-23T00:00:00.000Z",
            requirement_key: "major-credit-2025",
            label: "Major",
            category: "Major",
            required_credits: "70.00",
            required_course_codes: [],
            required_course_titles: ["Operating Systems"],
            course_groups: [],
            program_track: null,
            min_courses: null,
            applies_to: {},
            rule_status: "confirmed",
            note: null,
          },
          {
            source_id: 73,
            department: "All departments",
            admission_year: 2023,
            source_kind: "department_page",
            source_title: "Common liberal requirements",
            source_url: "https://example.test/common/2023",
            source_published_at: null,
            source_retrieved_at: "2026-05-23T00:00:00.000Z",
            requirement_key: "common-liberal-2023",
            label: "Common Liberal",
            category: "Common Liberal",
            required_credits: "17.00",
            required_course_codes: [],
            required_course_titles: ["English 1"],
            course_groups: [],
            program_track: null,
            min_courses: null,
            applies_to: {},
            rule_status: "confirmed",
            note: null,
          },
        ],
        rowCount: 3,
        command: "SELECT",
        oid: 0,
        fields: [],
      }),
    };

    const items = await listGraduationRequirementSources(pool as never, {
      department: "Computer Engineering",
      admissionYear: 2025,
    });

    expect(items.map((source) => source.sourceTitle)).toEqual([
      "Computer Engineering 2025 requirements",
      "Common liberal requirements",
    ]);
    expect(items[0]?.rules[0]?.requiredCourseTitles).toEqual(["Operating Systems"]);
  });

  it("filters source-level cohort ranges before rule fallback", async () => {
    const pool = {
      query: async () => ({
        rows: [
          {
            source_id: 81,
            department: "Natural Science 2018-2024 cohort",
            admission_year: 2018,
            source_kind: "official_handbook",
            source_title: "Natural Science 2018-2024 cohort requirements",
            source_url: "https://example.test/natural-science/2018-2024",
            source_published_at: null,
            source_retrieved_at: "2026-05-23T00:00:00.000Z",
            requirement_key: "legacy-natural-science",
            label: "Major",
            category: "Major",
            required_credits: "63.00",
            required_course_codes: [],
            required_course_titles: ["Legacy Lab"],
            course_groups: [],
            program_track: null,
            min_courses: null,
            applies_to: {},
            rule_status: "confirmed",
            note: null,
          },
          {
            source_id: 82,
            department: "Physics",
            admission_year: 2025,
            source_kind: "official_handbook",
            source_title: "Physics 2025+ requirements unavailable",
            source_url: "https://example.test/physics/2025",
            source_published_at: null,
            source_retrieved_at: "2026-05-23T00:00:00.000Z",
            requirement_key: "official-graduation-requirements-unprovided-2025",
            label: "Official graduation requirements",
            category: "Official graduation requirements",
            required_credits: null,
            required_course_codes: [],
            required_course_titles: [],
            course_groups: [],
            program_track: null,
            min_courses: null,
            applies_to: {},
            rule_status: "unprovided",
            note: null,
          },
        ],
        rowCount: 2,
        command: "SELECT",
        oid: 0,
        fields: [],
      }),
    };

    const items = await listGraduationRequirementSources(pool as never, {
      department: "Physics",
      admissionYear: 2025,
    });

    expect(items.map((source) => source.sourceTitle)).toEqual([
      "Physics 2025+ requirements unavailable",
    ]);
    expect(items[0]?.rules[0]?.status).toBe("unprovided");
  });

  it("filters rule-level admission year and expected graduation term applicability", async () => {
    const pool = {
      query: async () => ({
        rows: [
          {
            source_id: 11,
            department: "화학공학전공",
            admission_year: 2024,
            source_kind: "department_page",
            source_title: "화학공학전공 교과과정",
            source_url: "https://www.mju.ac.kr/mjukr/759/subview.do",
            source_published_at: null,
            source_retrieved_at: "2026-05-23T00:00:00.000Z",
            requirement_key: "foundational-liberal-credit-2027-aug-plus",
            label: "학문기초교양",
            category: "학문기초교양",
            required_credits: "24.00",
            required_course_codes: [],
            required_course_titles: [],
            course_groups: [],
            program_track: "심화프로그램 비적용",
            min_courses: null,
            applies_to: { admissionYearFrom: 2018, graduationTermFrom: "2027-08" },
            rule_status: "confirmed",
            note: null,
          },
          {
            source_id: 11,
            department: "화학공학전공",
            admission_year: 2024,
            source_kind: "department_page",
            source_title: "화학공학전공 교과과정",
            source_url: "https://www.mju.ac.kr/mjukr/759/subview.do",
            source_published_at: null,
            source_retrieved_at: "2026-05-23T00:00:00.000Z",
            requirement_key: "legacy-before-2027-aug",
            label: "기존 학문기초교양",
            category: "학문기초교양",
            required_credits: "15.00",
            required_course_codes: [],
            required_course_titles: [],
            course_groups: [],
            program_track: "비인증",
            min_courses: null,
            applies_to: { admissionYearFrom: 2018, graduationTermTo: "2027-02" },
            rule_status: "confirmed",
            note: null,
          },
        ],
        rowCount: 2,
        command: "SELECT",
        oid: 0,
        fields: [],
      }),
    };

    const after2027 = await listGraduationRequirementSources(pool as never, {
      department: "화학공학전공",
      admissionYear: 2024,
      expectedGraduationTerm: "2027-08",
    });
    expect(after2027).toHaveLength(1);
    expect(after2027[0]?.rules.map((rule) => rule.requirementKey)).toEqual([
      "foundational-liberal-credit-2027-aug-plus",
    ]);

    const before2027 = await listGraduationRequirementSources(pool as never, {
      department: "화학공학전공",
      admissionYear: 2024,
      expectedGraduationTerm: "2027-02",
    });
    expect(before2027).toHaveLength(1);
    expect(before2027[0]?.rules.map((rule) => rule.requirementKey)).toEqual([
      "legacy-before-2027-aug",
    ]);
  });

  it("keeps mapped 2025 department profiles separated from earlier cohorts", async () => {
    const observed: { params?: unknown[] } = {};
    const pool = {
      query: async (_sql: string, params: unknown[]) => {
        observed.params = params;
        return {
          rows: [
            {
              source_id: 31,
              department: "2025학번 컴퓨터정보통신공학부 공통",
              admission_year: 2025,
              source_kind: "official_handbook",
              source_title: "명지대학교 졸업요건 2025학번 이후",
              source_url: "https://www.mju.ac.kr/mjukr/473/subview.do",
              source_published_at: null,
              source_retrieved_at: "2026-05-23T00:00:00.000Z",
              requirement_key: "foundational-liberal-credit",
              label: "학문기초교양",
              category: "학문기초교양",
              required_credits: "15.00",
              required_course_codes: [],
              required_course_titles: [],
              course_groups: [],
              program_track: null,
              min_courses: null,
              applies_to: { admissionYearFrom: 2025 },
              rule_status: "confirmed",
              note: "2025학번 이후 컴퓨터정보통신공학부 공통 학점표 기준",
            },
          ],
          rowCount: 1,
          command: "SELECT",
          oid: 0,
          fields: [],
        };
      },
    };

    const items = await listGraduationRequirementSources(pool as never, {
      department: "15610 컴퓨터정보통신공학부",
      admissionYear: 2024,
    });

    expect(observed.params?.[2]).not.toContain("2025학번 컴퓨터정보통신공학부 공통");
    expect(items).toEqual([]);
  });

  it("filters foreign-only course groups unless the query requests foreign student rules", async () => {
    const pool = {
      query: async () => ({
        rows: [
          {
            source_id: 41,
            department: "All departments",
            admission_year: 2023,
            source_kind: "official_page",
            source_title: "Common liberal requirements",
            source_url: "https://www.mju.ac.kr/bangmok/1649/subview.do",
            source_published_at: null,
            source_retrieved_at: "2026-05-23T00:00:00.000Z",
            requirement_key: "common-liberal-language",
            label: "Language",
            category: "Common liberal",
            required_credits: null,
            required_course_codes: [],
            required_course_titles: [],
            course_groups: [
              {
                groupKey: "english-basic",
                label: "English basic",
                requiredCredits: 4,
                minCourses: 2,
                requiredCourseTitles: ["English 1", "English 2"],
              },
              {
                groupKey: "korean-basic-foreign",
                label: "Korean basic",
                requiredCredits: 4,
                minCourses: 2,
                requiredCourseTitles: ["Korean 1", "Korean 2"],
                appliesTo: { studentType: "foreign" },
              },
            ],
            program_track: null,
            min_courses: null,
            applies_to: { admissionYearFrom: 2023 },
            rule_status: "confirmed",
            note: null,
          },
        ],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      }),
    };

    const domesticItems = await listGraduationRequirementSources(pool as never, {
      department: "Computer Engineering",
      admissionYear: 2024,
    });
    expect(domesticItems[0]?.rules[0]?.courseGroups.map((group) => group.groupKey)).toEqual([
      "english-basic",
    ]);

    const foreignItems = await listGraduationRequirementSources(pool as never, {
      department: "Computer Engineering",
      admissionYear: 2024,
      studentType: "foreign",
    });
    expect(foreignItems[0]?.rules[0]?.courseGroups.map((group) => group.groupKey)).toEqual([
      "english-basic",
      "korean-basic-foreign",
    ]);
    expect(foreignItems[0]?.rules[0]?.courseGroups[1]?.appliesTo).toEqual({
      studentType: "foreign",
    });
  });

  it("filters course groups by admission year and expected graduation term applicability", async () => {
    const pool = {
      query: async () => ({
        rows: [
          {
            source_id: 51,
            department: "Computer Engineering",
            admission_year: 2023,
            source_kind: "department_page",
            source_title: "Computer Engineering requirements",
            source_url: "https://www.mju.ac.kr/mjukr/808/subview.do",
            source_published_at: null,
            source_retrieved_at: "2026-05-23T00:00:00.000Z",
            requirement_key: "language-track",
            label: "Language",
            category: "Common liberal",
            required_credits: null,
            required_course_codes: [],
            required_course_titles: [],
            course_groups: [
              {
                groupKey: "legacy-track",
                label: "Legacy group",
                requiredCourseTitles: ["Legacy Course"],
                appliesTo: { admissionYearTo: 2024, graduationTermTo: "2027-02" },
              },
              {
                groupKey: "future-track",
                label: "Future group",
                requiredCourseTitles: ["Future Course"],
                appliesTo: { admissionYearFrom: 2025 },
              },
              {
                groupKey: "late-track",
                label: "Late group",
                requiredCourseTitles: ["Late Course"],
                appliesTo: { graduationTermFrom: "2027-08" },
              },
            ],
            program_track: null,
            min_courses: null,
            applies_to: { admissionYearFrom: 2023 },
            rule_status: "confirmed",
            note: null,
          },
        ],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      }),
    };

    const legacyItems = await listGraduationRequirementSources(pool as never, {
      department: "Computer Engineering",
      admissionYear: 2024,
      expectedGraduationTerm: "2027-02",
    });
    expect(legacyItems[0]?.rules[0]?.courseGroups.map((group) => group.groupKey)).toEqual([
      "legacy-track",
    ]);

    const futureItems = await listGraduationRequirementSources(pool as never, {
      department: "Computer Engineering",
      admissionYear: 2025,
      expectedGraduationTerm: "2027-08",
    });
    expect(futureItems[0]?.rules[0]?.courseGroups.map((group) => group.groupKey)).toEqual([
      "future-track",
      "late-track",
    ]);
  });

  it("drops sources whose rules do not apply to the requested admission year", async () => {
    const pool = {
      query: async () => ({
        rows: [
          {
            source_id: 21,
            department: "컴퓨터공학전공",
            admission_year: 2025,
            source_kind: "department_page",
            source_title: "컴퓨터공학전공 2025 기준",
            source_url: "https://www.mju.ac.kr/mjukr/808/subview.do",
            source_published_at: null,
            source_retrieved_at: "2026-05-23T00:00:00.000Z",
            requirement_key: "major-credit-2025",
            label: "전공",
            category: "전공",
            required_credits: "70.00",
            required_course_codes: [],
            required_course_titles: [],
            course_groups: [],
            program_track: "비인증",
            min_courses: null,
            applies_to: { admissionYearFrom: 2025 },
            rule_status: "confirmed",
            note: null,
          },
        ],
        rowCount: 1,
        command: "SELECT",
        oid: 0,
        fields: [],
      }),
    };

    const items = await listGraduationRequirementSources(pool as never, {
      department: "컴퓨터공학전공",
      admissionYear: 2024,
    });

    expect(items).toEqual([]);
  });
});
