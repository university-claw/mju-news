import { describe, expect, it } from "vitest";
import {
  buildGraduationCoverageAudit,
  buildGraduationRequirementListResult,
  graduationDepartmentCandidates,
  graduationRequirementUnavailableReason,
  inferAdmissionYearFromStudentNumber,
  listGraduationRequirementSourcesFromSeeds,
  resolveAdmissionYearForGraduationQuery,
  validateDepartment,
  validateGraduationTerm,
  validateStudentNumber,
  validateStudentType,
} from "../../src/commands/graduation-requirements.js";
import { buildRootCommand } from "../../src/commands/root.js";
import { InputError } from "../../src/errors.js";

describe("graduation-requirements command validation", () => {
  it("accepts a Korean department name", () => {
    expect(validateDepartment("컴퓨터공학과")).toBe("컴퓨터공학과");
  });

  it("rejects blank department input", () => {
    expect(() => validateDepartment("   ")).toThrow(InputError);
  });

  it("validates expected graduation term input", () => {
    expect(validateGraduationTerm("2027-08")).toBe("2027-08");
    expect(validateGraduationTerm(undefined)).toBeUndefined();
    expect(() => validateGraduationTerm("2027-8")).toThrow(InputError);
    expect(() => validateGraduationTerm("fall-2027")).toThrow(InputError);
  });

  it("infers admission year from an MSI-style student number", () => {
    expect(validateStudentNumber(" TEST-99241234 ")).toBe("TEST-99241234");
    expect(inferAdmissionYearFromStudentNumber("TEST-99241234")).toBe(2024);
    expect(inferAdmissionYearFromStudentNumber("202412345")).toBe(2024);
    expect(inferAdmissionYearFromStudentNumber(undefined)).toBeUndefined();
    expect(() => validateStudentNumber("   ")).toThrow(InputError);
  });

  it("normalizes student type aliases", () => {
    expect(validateStudentType(undefined)).toBeUndefined();
    expect(validateStudentType("domestic")).toBe("domestic");
    expect(validateStudentType("local")).toBe("domestic");
    expect(validateStudentType("foreign")).toBe("foreign");
    expect(validateStudentType("international")).toBe("foreign");
    expect(validateStudentType("내국인")).toBe("domestic");
    expect(validateStudentType("외국인")).toBe("foreign");
    expect(() => validateStudentType("exchange")).toThrow(InputError);
  });

  it("uses student number only as a fallback for admission year", () => {
    expect(resolveAdmissionYearForGraduationQuery({
      studentNumber: "TEST-99241234",
    })).toBe(2024);
    expect(resolveAdmissionYearForGraduationQuery({
      admissionYear: "2024",
      studentNumber: "TEST-99241234",
    })).toBe(2024);
    expect(resolveAdmissionYearForGraduationQuery({
      admissionYear: "2025",
    })).toBe(2025);
    expect(() => resolveAdmissionYearForGraduationQuery({
      admissionYear: "2025",
      studentNumber: "TEST-99241234",
    })).toThrow(InputError);
    expect(() => resolveAdmissionYearForGraduationQuery({})).toThrow(InputError);
  });

  it("keeps graduation-requirements query context in list output", () => {
    const result = buildGraduationRequirementListResult([], {
      department: "Chemical Engineering",
      admissionYear: 2024,
      expectedGraduationTerm: "2027-08",
      studentNumberProvided: true,
    });

    expect(result).toEqual({
      total: 0,
      items: [],
      query: {
        department: "Chemical Engineering",
        admissionYear: 2024,
        expectedGraduationTerm: "2027-08",
        studentNumberProvided: true,
        unavailableReason: "2024학번 기준 선택한 학과/전공 조합의 공식 졸업요건 데이터가 아직 등록되지 않았습니다.",
      },
    });
  });

  it("keeps student type in graduation-requirements query context", () => {
    const result = buildGraduationRequirementListResult([{} as never], {
      department: "Computer Engineering",
      admissionYear: 2024,
      studentType: "foreign",
    });

    expect(result.query).toMatchObject({
      department: "Computer Engineering",
      admissionYear: 2024,
      studentType: "foreign",
    });
  });

  it("audits course catalog departments against official requirement seeds", () => {
    const result = buildGraduationCoverageAudit({
      admissionYear: 2025,
      courseCatalog: [
        {
          metadata: {
            departmentOptions: [
              { code: "10000", label: "10000 자연캠퍼스 교양" },
              { code: "15420", label: "15420 스마트인프라공학부" },
              { code: "15421", label: "15421 스마트인프라공학부 환경시스템공학전공" },
              { code: "15424", label: "15424 스마트인프라공학부 글로벌스마트인프라공학전공" },
              { code: "15440", label: "15440 Smart Social Infra Maintenance" },
              { code: "15611", label: "15611 컴퓨터정보통신공학부 컴퓨터공학전공" },
              { code: "19999", label: "19999 신규학과" },
            ],
          },
        },
      ],
      requirementSources: [
        {
          file: "profile-2025-smart-infra-environment-system.json",
          department: "2025학번 스마트인프라공학부 환경시스템공학전공",
          admissionYear: 2025,
          rules: [{ status: "confirmed" }],
        },
        {
          file: "global-smart-infra-2025-unprovided.json",
          department: "글로벌스마트인프라공학전공",
          admissionYear: 2025,
          rules: [{ status: "unprovided" }],
        },
        {
          file: "profile-2025-computer-info-communication.json",
          department: "2025학번 컴퓨터정보통신공학부 공통",
          admissionYear: 2025,
          rules: [{ status: "confirmed" }],
        },
      ],
    });

    expect(result.summary).toEqual({
      confirmed: 2,
      unprovided: 1,
      "catalog-bucket": 3,
      missing: 1,
    });
    expect(result.completionSummary).toEqual({
      complete: 2,
      partial: 0,
      unprovided: 1,
      "catalog-bucket": 3,
      missing: 1,
    });
    expect(result.departments.find((item) => item.code === "15420")).toMatchObject({
      status: "catalog-bucket",
      completionStatus: "catalog-bucket",
      reason: "department group catalog bucket",
    });
    expect(result.departments.find((item) => item.code === "15424")).toMatchObject({
      status: "unprovided",
      completionStatus: "unprovided",
      unprovidedRuleCount: 1,
    });
    expect(result.departments.find((item) => item.code === "15440")).toMatchObject({
      status: "catalog-bucket",
      completionStatus: "catalog-bucket",
      reason: "non-undergraduate catalog bucket",
    });
    expect(result.departments.find((item) => item.code === "15611")).toMatchObject({
      status: "confirmed",
      completionStatus: "complete",
    });
    expect(result.departments.find((item) => item.code === "19999")).toMatchObject({
      status: "missing",
      completionStatus: "missing",
    });
  });

  it("skips catalog departments before their first supported admission year", () => {
    const result = buildGraduationCoverageAudit({
      admissionYear: 2024,
      courseCatalog: [
        {
          metadata: {
            departmentOptions: [
              { code: "16482", label: "16482 Applied Statistics" },
            ],
          },
        },
      ],
      requirementSources: [],
    });

    expect(result.departments[0]).toMatchObject({
      status: "catalog-bucket",
      completionStatus: "catalog-bucket",
      reason: "not offered for admission year",
    });
  });

  it("separates partial coverage when confirmed sources still contain unprovided rules", () => {
    const result = buildGraduationCoverageAudit({
      admissionYear: 2025,
      courseCatalog: [
        {
          metadata: {
            departmentOptions: [
              { code: "15611", label: "15611 컴퓨터정보통신공학부 컴퓨터공학전공" },
            ],
          },
        },
      ],
      requirementSources: [
        {
          file: "profile-2025-computer-info-communication.json",
          department: "2025학번 컴퓨터정보통신공학부 공통",
          admissionYear: 2025,
          rules: [
            { requirementKey: "major-credit", status: "confirmed", appliesTo: { admissionYearFrom: 2025 } },
            { requirementKey: "major-required-courses-2025-plus", status: "unprovided", appliesTo: { admissionYearFrom: 2025 } },
          ],
        },
      ],
    });

    expect(result.summary.confirmed).toBe(1);
    expect(result.completionSummary.partial).toBe(1);
    expect(result.departments[0]).toMatchObject({
      status: "confirmed",
      completionStatus: "partial",
      unprovidedRuleCount: 1,
    });
  });

  it("audits universal requirements against department applicability rules", () => {
    const result = buildGraduationCoverageAudit({
      admissionYear: 2026,
      courseCatalog: [
        {
          metadata: {
            departmentOptions: [
              { code: "10000", label: "10000 자연캠퍼스 교양" },
              { code: "15809", label: "15809 수학과" },
              { code: "15821", label: "15821 융합바이오학부 식품영양학전공" },
            ],
          },
        },
      ],
      requirementSources: [
        {
          file: "common-foundational-math-placement-2026.json",
          department: "전체 학부(과)",
          admissionYear: 2026,
          rules: [
            {
              status: "confirmed",
              appliesTo: {
                admissionYearFrom: 2026,
                departmentPatterns: ["^158"],
                departmentExcludes: ["식품영양"],
              },
            },
          ],
        },
      ],
    });

    expect(result.departments.find((item) => item.code === "10000")).toMatchObject({
      completionStatus: "catalog-bucket",
    });
    expect(result.departments.find((item) => item.code === "15809")).toMatchObject({
      completionStatus: "complete",
      matchedSources: [
        expect.objectContaining({ file: "common-foundational-math-placement-2026.json" }),
      ],
    });
    expect(result.departments.find((item) => item.code === "15821")).toMatchObject({
      completionStatus: "missing",
    });
  });

  it("does not count a profile unprovided rule when a department source confirms the same rule", () => {
    const result = buildGraduationCoverageAudit({
      admissionYear: 2026,
      courseCatalog: [
        {
          metadata: {
            departmentOptions: [
              { code: "15612", label: "15612 컴퓨터정보통신공학부 정보통신공학전공" },
            ],
          },
        },
      ],
      requirementSources: [
        {
          file: "profile-2025-computer-info-communication.json",
          department: "2025학번 컴퓨터정보통신공학부 공통",
          admissionYear: 2025,
          rules: [
            {
              requirementKey: "major-required-courses-2025-plus",
              label: "전공필수",
              category: "전공",
              status: "unprovided",
              appliesTo: { admissionYearFrom: 2025 },
            },
          ],
        },
        {
          file: "information-communication-engineering-2025-plus.json",
          department: "정보통신공학전공",
          admissionYear: 2025,
          rules: [
            {
              requirementKey: "major-required-courses-2027-aug-plus",
              label: "전공필수",
              category: "전공",
              status: "confirmed",
              appliesTo: { admissionYearFrom: 2025 },
            },
          ],
        },
      ],
    });

    expect(result.departments[0]).toMatchObject({
      status: "confirmed",
      completionStatus: "complete",
      unprovidedRuleCount: 0,
      matchedSources: [
        expect.objectContaining({ file: "information-communication-engineering-2025-plus.json" }),
      ],
    });
    expect(result.departments[0].matchedSources.some((source) => (
      source.file === "profile-2025-computer-info-communication.json"
    ))).toBe(false);
  });

  it("uses department-scoped handbook sources outside direct lookup candidates", () => {
    const result = buildGraduationCoverageAudit({
      admissionYear: 2026,
      courseCatalog: [
        {
          metadata: {
            departmentOptions: [
              { code: "12345", label: "12345 Test Department" },
            ],
          },
        },
      ],
      requirementSources: [
        {
          file: "profile.json",
          department: "12345 Test Department",
          admissionYear: 2025,
          rules: [
            {
              requirementKey: "major-required-unprovided",
              label: "Major required",
              category: "Major",
              status: "unprovided",
              appliesTo: { admissionYearFrom: 2025 },
            },
          ],
        },
        {
          file: "official-handbook-section.json",
          department: "2026 official handbook major table",
          admissionYear: 2026,
          rules: [
            {
              requirementKey: "major-required-confirmed",
              label: "Major required",
              category: "Major",
              status: "confirmed",
              appliesTo: { admissionYearFrom: 2025, departmentPatterns: ["^12345\\b"] },
            },
          ],
        },
      ],
    });

    expect(result.departments[0]).toMatchObject({
      status: "confirmed",
      completionStatus: "complete",
      unprovidedRuleCount: 0,
      matchedSources: [
        expect.objectContaining({ file: "official-handbook-section.json" }),
      ],
    });
  });

  it("treats 전공필수 and 전공 필수 과목 as the same shadowed requirement", () => {
    const result = buildGraduationCoverageAudit({
      admissionYear: 2026,
      courseCatalog: [
        {
          metadata: {
            departmentOptions: [
              { code: "99999", label: "99999 테스트학과" },
            ],
          },
        },
      ],
      requirementSources: [
        {
          file: "profile.json",
          department: "테스트학과",
          admissionYear: 2025,
          rules: [
            {
              requirementKey: "major-required-courses-2025-plus",
              label: "전공필수",
              category: "전공",
              status: "unprovided",
              appliesTo: { admissionYearFrom: 2025 },
            },
          ],
        },
        {
          file: "department.json",
          department: "테스트학과",
          admissionYear: 2025,
          rules: [
            {
              requirementKey: "major-required-courses-2024-plus",
              label: "전공 필수 과목",
              category: "전공",
              status: "confirmed",
              appliesTo: { admissionYearFrom: 2024 },
            },
          ],
        },
      ],
    });

    expect(result.departments[0]).toMatchObject({
      status: "confirmed",
      completionStatus: "complete",
      unprovidedRuleCount: 0,
    });
  });

  it("keeps only the most specific unprovided rule for the same requirement", () => {
    const result = buildGraduationCoverageAudit({
      admissionYear: 2026,
      courseCatalog: [
        {
          metadata: {
            departmentOptions: [
              { code: "15431", label: "15431 기계시스템공학부 기계공학전공" },
            ],
          },
        },
      ],
      requirementSources: [
        {
          file: "profile-2025-mechanical-system.json",
          department: "2025학번 기계시스템공학부 공통",
          admissionYear: 2025,
          rules: [
            {
              requirementKey: "major-required-courses-2025-plus",
              label: "전공필수",
              category: "전공",
              status: "unprovided",
              appliesTo: { admissionYearFrom: 2025 },
            },
          ],
        },
        {
          file: "mechanical-engineering-2025-plus.json",
          department: "기계공학전공",
          admissionYear: 2025,
          rules: [
            {
              requirementKey: "major-required-courses-2025-plus",
              label: "전공필수",
              category: "전공",
              status: "unprovided",
              appliesTo: { admissionYearFrom: 2025 },
            },
          ],
        },
      ],
    });

    expect(result.departments[0]).toMatchObject({
      status: "unprovided",
      completionStatus: "unprovided",
      unprovidedRuleCount: 1,
      matchedSources: [
        expect.objectContaining({ file: "mechanical-engineering-2025-plus.json" }),
      ],
    });
    expect(result.departments[0].matchedSources.some((source) => (
      source.file === "profile-2025-mechanical-system.json"
    ))).toBe(false);
  });

  it("keeps audit coverage separated by student-number cohort", () => {
    const base = {
      courseCatalog: [
        {
          metadata: {
            departmentOptions: [
              { code: "15611", label: "15611 컴퓨터정보통신공학부 컴퓨터공학전공" },
            ],
          },
        },
      ],
      requirementSources: [
        {
          file: "computer-engineering-2024-plus.json",
          department: "컴퓨터공학전공",
          admissionYear: 2024,
          rules: [
            {
              status: "confirmed",
              appliesTo: {
                admissionYearFrom: 2024,
                admissionYearTo: 2024,
              },
            },
          ],
        },
      ],
    };

    expect(buildGraduationCoverageAudit({
      ...base,
      admissionYear: inferAdmissionYearFromStudentNumber("TEST-99241234") ?? 2024,
    }).summary.confirmed).toBe(1);
    expect(buildGraduationCoverageAudit({
      ...base,
      admissionYear: inferAdmissionYearFromStudentNumber("TEST-99251234") ?? 2025,
    }).summary.missing).toBe(1);
  });

  it("maps a code-only MSI department to the admission-year profile", () => {
    expect(graduationDepartmentCandidates("15611", 2024)).toContain("컴퓨터공학전공");
    expect(graduationDepartmentCandidates("15611", 2025)).toContain(
      "2025학번 컴퓨터정보통신공학부 공통",
    );
    expect(graduationDepartmentCandidates("15611", 2024)).not.toContain(
      "2025학번 컴퓨터정보통신공학부 공통",
    );
  });

  it("lists requirement seeds by department and inferred student-number cohort", () => {
    const items = listGraduationRequirementSourcesFromSeeds([
      {
        id: 1,
        department: "컴퓨터공학전공",
        admissionYear: 2024,
        sourceKind: "department_page",
        sourceTitle: "컴퓨터공학전공 2024 기준",
        sourceUrl: "https://cs.mju.ac.kr/cs/10763/subview.do",
        sourcePublishedAt: null,
        sourceRetrievedAt: "2026-05-23T00:00:00.000Z",
        rules: [
          {
            requirementKey: "major-2024",
            label: "전공",
            category: "전공",
            requiredCredits: 66,
            requiredCourseCodes: [],
            requiredCourseTitles: ["자료구조"],
            courseGroups: [],
            programTrack: null,
            minCourses: null,
            appliesTo: { admissionYearFrom: 2024, admissionYearTo: 2024 },
            status: "confirmed",
            note: "2024학번 기준",
          },
        ],
      },
      {
        id: 2,
        department: "컴퓨터공학전공",
        admissionYear: 2025,
        sourceKind: "department_page",
        sourceTitle: "컴퓨터공학전공 2025 기준",
        sourceUrl: "https://www.mju.ac.kr/mjukr/808/subview.do",
        sourcePublishedAt: null,
        sourceRetrievedAt: "2026-05-23T00:00:00.000Z",
        rules: [
          {
            requirementKey: "major-2025",
            label: "전공",
            category: "전공",
            requiredCredits: 70,
            requiredCourseCodes: [],
            requiredCourseTitles: ["운영체제"],
            courseGroups: [],
            programTrack: null,
            minCourses: null,
            appliesTo: { admissionYearFrom: 2025 },
            status: "confirmed",
            note: "2025학번 기준",
          },
        ],
      },
    ], {
      department: "15611 컴퓨터정보통신공학부 컴퓨터공학전공",
      admissionYear: inferAdmissionYearFromStudentNumber("TEST-99241234") ?? 2024,
      studentNumberProvided: true,
    });

    expect(items).toHaveLength(1);
    expect(items[0].admissionYear).toBe(2024);
    expect(items[0].rules[0].requiredCourseTitles).toEqual(["자료구조"]);
  });

  it("applies foundational math placement only to official target departments", () => {
    const sources = [
      {
        id: 1,
        department: "전체 학부(과)",
        admissionYear: 2026,
        sourceKind: "department_page",
        sourceTitle: "방목기초교육대학 2026학년도 신입생 학습능력평가",
        sourceUrl: "https://bangmok.mju.ac.kr/bangmok/10034/subview.do",
        sourcePublishedAt: "2025-12-29",
        sourceRetrievedAt: "2026-05-27",
        rules: [
          {
            requirementKey: "foundational-math-placement-2026",
            label: "미적분학 단계",
            category: "학문기초교양",
            requiredCredits: null,
            requiredCourseCodes: [],
            requiredCourseTitles: [],
            courseGroups: [
              {
                groupKey: "math-placement-basic",
                label: "대학기초수학 1단계",
                requiredCredits: null,
                minCourses: 3,
                requiredCourseCodes: [],
                requiredCourseTitles: ["기초미적분학", "미적분학1", "미적분학2"],
                groupType: "alternative",
                alternativeGroup: "math-placement-sequence",
                appliesTo: {},
                note: "평가 미응시자 포함",
              },
              {
                groupKey: "math-placement-standard",
                label: "대학기초수학 2단계",
                requiredCredits: null,
                minCourses: 2,
                requiredCourseCodes: [],
                requiredCourseTitles: ["미적분학1", "미적분학2"],
                groupType: "alternative",
                alternativeGroup: "math-placement-sequence",
                appliesTo: {},
                note: "미적분학1부터 이수",
              },
            ],
            programTrack: null,
            minCourses: null,
            appliesTo: {
              admissionYearFrom: 2026,
              departmentPatterns: [
                "^(?:154(?:11|12|21|22|23|24|31|32|40)|156(?:11|12|21|22|30|40|50)|158(?:08|09|11|12|21|22))\\b",
                "(?:화학·생명과학|스마트시스템공과|반도체|ICT|컴퓨터정보통신|컴퓨터공학)",
              ],
              departmentExcludes: ["식품영양", "^(?:15400|15420|15430|15600|15610|15620|15800)\\b"],
            },
            status: "confirmed",
            note: "대학기초수학 단계 배치 기준",
          },
        ],
      },
    ];

    const targetItems = listGraduationRequirementSourcesFromSeeds(sources, {
      department: "15611 컴퓨터정보통신공학부 컴퓨터공학전공",
      admissionYear: 2026,
    });
    const mathItems = listGraduationRequirementSourcesFromSeeds(sources, {
      department: "15809 수학과",
      admissionYear: 2026,
    });
    const semiconductorItems = listGraduationRequirementSourcesFromSeeds(sources, {
      department: "15650 반도체시스템공학과",
      admissionYear: 2026,
    });
    const globalInfraItems = listGraduationRequirementSourcesFromSeeds(sources, {
      department: "15424 스마트인프라공학부 글로벌스마트인프라공학전공",
      admissionYear: 2026,
    });
    const smartSocialInfraItems = listGraduationRequirementSourcesFromSeeds(sources, {
      department: "15440 스마트사회인프라유지관리학과",
      admissionYear: 2026,
    });
    const smartInfraBucketItems = listGraduationRequirementSourcesFromSeeds(sources, {
      department: "15420 스마트인프라공학부",
      admissionYear: 2026,
    });
    const excludedItems = listGraduationRequirementSourcesFromSeeds(sources, {
      department: "식품영양학전공",
      admissionYear: 2026,
    });
    const earlierCohortItems = listGraduationRequirementSourcesFromSeeds(sources, {
      department: "15611 컴퓨터정보통신공학부 컴퓨터공학전공",
      admissionYear: 2025,
    });

    expect(targetItems).toHaveLength(1);
    expect(targetItems[0].rules[0].courseGroups).toHaveLength(2);
    expect(targetItems[0].rules[0].courseGroups[0].requiredCourseTitles).toContain("기초미적분학");
    expect(mathItems).toHaveLength(1);
    expect(semiconductorItems).toHaveLength(1);
    expect(globalInfraItems).toHaveLength(1);
    expect(smartSocialInfraItems).toEqual([]);
    expect(smartInfraBucketItems).toEqual([]);
    expect(excludedItems).toEqual([]);
    expect(earlierCohortItems).toEqual([]);
  });

  it("does not list catalog-only departments that audit excludes", () => {
    const sources = [
      {
        id: 1,
        department: "글로벌스마트인프라공학전공",
        admissionYear: 2018,
        sourceKind: "department_page",
        sourceTitle: "2018-2023학번 글로벌스마트인프라공학전공 공식 졸업요건 미제공",
        sourceUrl: "https://gsie.mju.ac.kr/gsie/10872/subview.do",
        sourcePublishedAt: null,
        sourceRetrievedAt: "2026-05-27",
        rules: [
          {
            requirementKey: "official-graduation-requirements-unprovided-2018-2023",
            label: "공식 졸업요건",
            category: "공식 졸업요건",
            requiredCredits: null,
            requiredCourseCodes: [],
            requiredCourseTitles: [],
            courseGroups: [],
            programTrack: null,
            minCourses: null,
            appliesTo: { admissionYearFrom: 2018, admissionYearTo: 2023 },
            status: "unprovided",
            note: null,
          },
        ],
      },
      {
        id: 2,
        department: "전체 학부(과)",
        admissionYear: 2023,
        sourceKind: "official_notice",
        sourceTitle: "Common",
        sourceUrl: "https://www.mju.ac.kr",
        sourcePublishedAt: null,
        sourceRetrievedAt: "2026-05-27",
        rules: [
          {
            requirementKey: "common",
            label: "공통",
            category: "공통",
            requiredCredits: 1,
            requiredCourseCodes: [],
            requiredCourseTitles: [],
            courseGroups: [],
            programTrack: null,
            minCourses: null,
            appliesTo: { admissionYearFrom: 2023 },
            status: "confirmed",
            note: null,
          },
        ],
      },
    ];

    expect(listGraduationRequirementSourcesFromSeeds(sources, {
      department: "15424 스마트인프라공학부 글로벌스마트인프라공학전공",
      admissionYear: 2023,
    })).toEqual([]);
    expect(listGraduationRequirementSourcesFromSeeds(sources, {
      department: "15440 스마트사회인프라유지관리학과",
      admissionYear: 2026,
    })).toEqual([]);
  });

  it("explains empty graduation-requirements results without guessing criteria", () => {
    expect(graduationRequirementUnavailableReason("10000 자연캠퍼스 교양")).toBe(
      "교양 분류 코드는 졸업요건 조회 대상 학과/전공이 아닙니다. 학생 소속 학과/전공을 선택해야 합니다.",
    );
    expect(graduationRequirementUnavailableReason("15600 반도체·ICT대학")).toBe(
      "단과대학 단위는 전공별 졸업요건이 달라 학과/전공을 선택해야 합니다.",
    );
    expect(graduationRequirementUnavailableReason("19000 융합전공")).toBe(
      "융합전공 전체 단위는 세부 융합전공별 졸업요건이 달라 개별 전공을 선택해야 합니다.",
    );
    expect(graduationRequirementUnavailableReason("15420 스마트인프라공학부")).toBe(
      "학부 단위는 세부 전공별 졸업요건이 다를 수 있어 공식 전공 기준 데이터가 필요합니다.",
    );
    expect(graduationRequirementUnavailableReason("15424 스마트인프라공학부 글로벌스마트인프라공학전공")).toBe(
      "선택한 학부 내 전공의 공식 졸업요건 데이터가 아직 등록되지 않았습니다.",
    );
    expect(graduationRequirementUnavailableReason("15808 물리학과")).toBe(
      "선택한 학과/전공 조합의 공식 졸업요건 데이터가 아직 등록되지 않았습니다.",
    );
    expect(graduationRequirementUnavailableReason("15808 물리학과", 2025)).toBe(
      "2025학번 기준 선택한 학과/전공 조합의 공식 졸업요건 데이터가 아직 등록되지 않았습니다.",
    );
    expect(graduationRequirementUnavailableReason("15424 스마트인프라공학부 글로벌스마트인프라공학전공", 2025)).toBe(
      "2025학번 기준 선택한 학부 내 전공의 공식 졸업요건 데이터가 아직 등록되지 않았습니다.",
    );
  });

  it("attaches the graduation-requirements group to the root command", () => {
    const root = buildRootCommand();
    expect(root.commands.map((command) => command.name())).toContain(
      "graduation-requirements",
    );
  });
});
