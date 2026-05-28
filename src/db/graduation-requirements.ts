import type { Pool } from "pg";
import type {
  GraduationRequirementCourseGroup,
  GraduationRequirementRule,
  GraduationRequirementRuleStatus,
  GraduationRequirementSource,
} from "../types.js";

export interface ListGraduationRequirementOpts {
  department: string;
  admissionYear: number;
  expectedGraduationTerm?: string;
  studentType?: "domestic" | "foreign";
}

const UNIVERSAL_GRADUATION_REQUIREMENT_DEPARTMENTS = [
  "전체 학부(과)",
  "전체 학부",
  "전체 학과",
  "전체",
];

const PROFILE_2025_HUMANITIES_SOCIAL_MEDIA_FUTURE = "2025학번 인문·사회·미디어·미래 공통";
const PROFILE_2025_BUSINESS_MANAGEMENT = "2025학번 경영학전공·경영정보학과 공통";
const PROFILE_2025_GLOBAL_BUSINESS = "2025학번 글로벌비즈니스학전공 공통";
const PROFILE_2025_CHEMISTRY_LIFE = "2025학번 화학·생명과학 공통";
const PROFILE_2025_CHEMICAL_MATERIAL = "2025학번 화공신소재공학부 공통";
const PROFILE_2025_MECHANICAL_SYSTEM = "2025학번 기계시스템공학부 공통";
const PROFILE_2025_SMART_INFRA_CONSTRUCTION_ENVIRONMENT = "2025학번 스마트인프라공학부 건설환경공학전공";
const PROFILE_2025_SMART_INFRA_ENVIRONMENT_SYSTEM = "2025학번 스마트인프라공학부 환경시스템공학전공";
const PROFILE_2025_SMART_MOBILITY = "2025학번 스마트모빌리티공학전공";
const PROFILE_2025_ELECTRICAL_ELECTRONIC = "2025학번 전기전자공학부 공통";
const PROFILE_2025_COMPUTER_INFO_COMMUNICATION = "2025학번 컴퓨터정보통신공학부 공통";
const PROFILE_2025_INDUSTRIAL_MANAGEMENT = "2025학번 산업경영공학과";
const PROFILE_2025_CONVERGENCE_SOFTWARE = "2025학번 융합소프트웨어학부 공통";
const PROFILE_2025_SPORTS_ARTS = "2025학번 스포츠·예술 공통";
const PROFILE_2025_ARCHITECTURE_SPACE = "2025학번 건축학전공·공간디자인 공통";
const PROFILE_2025_TRADITIONAL_ARCHITECTURE = "2025학번 전통건축전공 공통";
const PROFILE_2018_2024_CONVERGENCE_SOFTWARE = "2018-2024학번 융합소프트웨어학부 공통";
const PROFILE_2018_2024_HUMANITIES_SOCIAL_FUTURE = "2018-2024학번 인문·사회·미래 공통";
const PROFILE_2018_2024_BUSINESS = "2018-2024학번 경영 공통";
const PROFILE_2018_2024_LAW = "2018-2024학번 법과 공통";
const PROFILE_2018_2024_NATURAL_SCIENCE = "2018-2024학번 자연과학 공통";
const PROFILE_2018_2024_SPORTS_ARTS = "2018-2024학번 예술체육 공통";
const PROFILE_2018_2024_ARCHITECTURE_SPACE = "2018-2024학번 건축학전공·공간디자인 공통";
const PROFILE_2018_2024_TRADITIONAL_ARCHITECTURE = "2018-2024학번 전통건축전공 공통";

const GRADUATION_DEPARTMENT_ALIASES_BY_CODE: Array<[RegExp, string]> = [
  [/^15411$/u, "화학공학전공"],
  [/^15412$/u, "신소재공학전공"],
  [/^15421$/u, "환경시스템공학전공"],
  [/^15422$/u, "건설환경공학전공"],
  [/^15423$/u, "스마트모빌리티공학전공"],
  [/^15424$/u, "글로벌스마트인프라공학전공"],
  [/^15440$/u, "스마트사회인프라유지관리학과"],
  [/^15431$/u, "기계공학전공"],
  [/^15432$/u, "로봇공학전공"],
  [/^15611$/u, "컴퓨터공학전공"],
  [/^15612$/u, "정보통신공학전공"],
  [/^15621$/u, "전기공학전공"],
  [/^15622$/u, "전자공학전공"],
  [/^15640$/u, "반도체공학부"],
  [/^15630$/u, "산업경영공학과"],
  [/^15650$/u, "반도체공학부"],
  [/^15808$/u, "물리학과"],
  [/^15809$/u, "수학과"],
  [/^18610$/u, "디지털콘텐츠디자인학과"],
  [/^18621$/u, "응용소프트웨어전공"],
  [/^18622$/u, "데이터사이언스전공"],
  [/^18623$/u, "인공지능전공"],
  [/^19034$/u, "제약바이오"],
  [/^19036$/u, "융합예술학"],
  [/^19038$/u, "멀티미디어콘텐츠크리에이션"],
];

const GRADUATION_DEPARTMENT_ALIASES_BY_TEXT: Array<[RegExp, string]> = [
  [/반도체시스템공학과/u, "반도체공학부"],
  [/융합예술학융합전공/u, "융합예술학"],
];

const NON_UNDERGRADUATE_CATALOG_DEPARTMENT_CODES = new Set([
  "15440",
]);

const CATALOG_DEPARTMENT_ADMISSION_YEAR_FROM_BY_CODE = new Map<string, number>([
  ["15424", 2025],
  ["15812", 2025],
  ["15822", 2025],
  ["16482", 2025],
]);

type GraduationProfileCandidate = {
  pattern: RegExp;
  profile: string;
  admissionYearFrom?: number;
  admissionYearTo?: number;
};

const GRADUATION_PROFILE_CANDIDATES_BY_CODE: GraduationProfileCandidate[] = [
  { pattern: /^146\d{2}$/u, profile: PROFILE_2025_HUMANITIES_SOCIAL_MEDIA_FUTURE, admissionYearFrom: 2025 },
  { pattern: /^146\d{2}$/u, profile: PROFILE_2018_2024_HUMANITIES_SOCIAL_FUTURE, admissionYearFrom: 2018, admissionYearTo: 2024 },
  { pattern: /^14\d{3}$/u, profile: PROFILE_2025_HUMANITIES_SOCIAL_MEDIA_FUTURE, admissionYearFrom: 2025 },
  { pattern: /^14\d{3}$/u, profile: PROFILE_2018_2024_HUMANITIES_SOCIAL_FUTURE, admissionYearFrom: 2018, admissionYearTo: 2024 },
  { pattern: /^164\d{2}$/u, profile: PROFILE_2025_HUMANITIES_SOCIAL_MEDIA_FUTURE, admissionYearFrom: 2025 },
  { pattern: /^164(?!90)\d{2}$/u, profile: PROFILE_2018_2024_HUMANITIES_SOCIAL_FUTURE, admissionYearFrom: 2018, admissionYearTo: 2024 },
  { pattern: /^16490$/u, profile: PROFILE_2018_2024_LAW, admissionYearFrom: 2018, admissionYearTo: 2024 },
  { pattern: /^172\d{2}$/u, profile: PROFILE_2025_HUMANITIES_SOCIAL_MEDIA_FUTURE, admissionYearFrom: 2025 },
  { pattern: /^172\d{2}$/u, profile: PROFILE_2018_2024_HUMANITIES_SOCIAL_FUTURE, admissionYearFrom: 2018, admissionYearTo: 2024 },
  { pattern: /^173\d{2}$/u, profile: PROFILE_2025_HUMANITIES_SOCIAL_MEDIA_FUTURE, admissionYearFrom: 2025 },
  { pattern: /^173\d{2}$/u, profile: PROFILE_2018_2024_HUMANITIES_SOCIAL_FUTURE, admissionYearFrom: 2018, admissionYearTo: 2024 },
  { pattern: /^(?:16640|16671)$/u, profile: PROFILE_2025_BUSINESS_MANAGEMENT, admissionYearFrom: 2025 },
  { pattern: /^166\d{2}$/u, profile: PROFILE_2018_2024_BUSINESS, admissionYearFrom: 2018, admissionYearTo: 2024 },
  { pattern: /^16672$/u, profile: PROFILE_2025_GLOBAL_BUSINESS, admissionYearFrom: 2025 },
  { pattern: /^158(?:11|12|21|22)$/u, profile: PROFILE_2025_CHEMISTRY_LIFE, admissionYearFrom: 2025 },
  { pattern: /^158\d{2}$/u, profile: PROFILE_2018_2024_NATURAL_SCIENCE, admissionYearFrom: 2018, admissionYearTo: 2024 },
  { pattern: /^(?:15411|15412)$/u, profile: PROFILE_2025_CHEMICAL_MATERIAL, admissionYearFrom: 2025 },
  { pattern: /^15421$/u, profile: PROFILE_2025_SMART_INFRA_ENVIRONMENT_SYSTEM, admissionYearFrom: 2025 },
  { pattern: /^15422$/u, profile: PROFILE_2025_SMART_INFRA_CONSTRUCTION_ENVIRONMENT, admissionYearFrom: 2025 },
  { pattern: /^15423$/u, profile: PROFILE_2025_SMART_MOBILITY, admissionYearFrom: 2025 },
  { pattern: /^(?:15430|15431|15432)$/u, profile: PROFILE_2025_MECHANICAL_SYSTEM, admissionYearFrom: 2025 },
  { pattern: /^(?:15610|15611|15612)$/u, profile: PROFILE_2025_COMPUTER_INFO_COMMUNICATION, admissionYearFrom: 2025 },
  { pattern: /^(?:15620|15621|15622)$/u, profile: PROFILE_2025_ELECTRICAL_ELECTRONIC, admissionYearFrom: 2025 },
  { pattern: /^15630$/u, profile: PROFILE_2025_INDUSTRIAL_MANAGEMENT, admissionYearFrom: 2025 },
  { pattern: /^(?:18620|18621|18622|18623)$/u, profile: PROFILE_2025_CONVERGENCE_SOFTWARE, admissionYearFrom: 2025 },
  { pattern: /^18620$/u, profile: PROFILE_2018_2024_CONVERGENCE_SOFTWARE, admissionYearFrom: 2018, admissionYearTo: 2024 },
  { pattern: /^176\d{2}$/u, profile: PROFILE_2025_SPORTS_ARTS, admissionYearFrom: 2025 },
  { pattern: /^176\d{2}$/u, profile: PROFILE_2018_2024_SPORTS_ARTS, admissionYearFrom: 2018, admissionYearTo: 2024 },
  { pattern: /^(?:18031|18040)$/u, profile: PROFILE_2025_ARCHITECTURE_SPACE, admissionYearFrom: 2025 },
  { pattern: /^(?:18031|18040)$/u, profile: PROFILE_2018_2024_ARCHITECTURE_SPACE, admissionYearFrom: 2018, admissionYearTo: 2024 },
  { pattern: /^18032$/u, profile: PROFILE_2025_TRADITIONAL_ARCHITECTURE, admissionYearFrom: 2025 },
  { pattern: /^18032$/u, profile: PROFILE_2018_2024_TRADITIONAL_ARCHITECTURE, admissionYearFrom: 2018, admissionYearTo: 2024 },
];

const GRADUATION_PROFILE_CANDIDATES_BY_TEXT: GraduationProfileCandidate[] = [
  { pattern: /^기계시스템공학부(?:\s+(?:기계공학전공|로봇공학전공))?$/u, profile: PROFILE_2025_MECHANICAL_SYSTEM, admissionYearFrom: 2025 },
  { pattern: /^컴퓨터정보통신공학부(?:\s+(?:컴퓨터공학전공|정보통신공학전공))?$/u, profile: PROFILE_2025_COMPUTER_INFO_COMMUNICATION, admissionYearFrom: 2025 },
  { pattern: /^전기전자공학부(?:\s+(?:전기공학전공|전자공학전공))?$/u, profile: PROFILE_2025_ELECTRICAL_ELECTRONIC, admissionYearFrom: 2025 },
  { pattern: /^융합소프트웨어학부(?:\s+(?:융합소프트웨어전공|응용소프트웨어전공|데이터사이언스전공|인공지능전공))?$/u, profile: PROFILE_2025_CONVERGENCE_SOFTWARE, admissionYearFrom: 2025 },
  { pattern: /^융합소프트웨어학부(?:\s+(?:융합소프트웨어전공|응용소프트웨어전공|데이터사이언스전공|인공지능전공))?$/u, profile: PROFILE_2018_2024_CONVERGENCE_SOFTWARE, admissionYearFrom: 2018, admissionYearTo: 2024 },
  { pattern: /(?:국어국문학|영어영문학|미술사·역사학|문헌정보학|글로벌문화콘텐츠학|중어중문학|일어일문학|아랍지역학|글로벌한국어학|문예창작학|행정학|정치외교학|경제학|국제통상학|응용통계학|법학|디지털미디어학|청소년지도학|아동학|사회복지학|부동산학|법무행정학|심리치료학|미래융합경영학|회계세무학|멀티디자인학|스포츠산업경영학|융합디자인학|아동복지경영학|복지상담경영학|미용예술학|웹툰콘텐츠학|미디어앤아트테크놀로지학|행정서비스경영학|영유아교육상담학|유아교육상담학)/u, profile: PROFILE_2025_HUMANITIES_SOCIAL_MEDIA_FUTURE, admissionYearFrom: 2025 },
  { pattern: /(?:국어국문학|영어영문학|미술사·역사학|문헌정보학|글로벌문화콘텐츠학|중어중문학|일어일문학|아랍지역학|글로벌한국어학|문예창작학|행정학|정치외교학|경제학|국제통상학|응용통계학|디지털미디어학|청소년지도학|아동학|사회복지학|부동산학|법무행정학|심리치료학|미래융합경영학|회계세무학|멀티디자인학|스포츠산업경영학|융합디자인학|아동복지경영학|복지상담경영학|미용예술학|웹툰콘텐츠학|미디어앤아트테크놀로지학|행정서비스경영학|영유아교육상담학|유아교육상담학)/u, profile: PROFILE_2018_2024_HUMANITIES_SOCIAL_FUTURE, admissionYearFrom: 2018, admissionYearTo: 2024 },
  { pattern: /법학/u, profile: PROFILE_2018_2024_LAW, admissionYearFrom: 2018, admissionYearTo: 2024 },
  { pattern: /(?:경영학전공|경영정보학과)/u, profile: PROFILE_2025_BUSINESS_MANAGEMENT, admissionYearFrom: 2025 },
  { pattern: /(?:^|\s)(?:경영학전공|경영학과|경영정보학과|글로벌비즈니스학전공|글로벌비즈니스학과)(?:$|\s|\()/u, profile: PROFILE_2018_2024_BUSINESS, admissionYearFrom: 2018, admissionYearTo: 2024 },
  { pattern: /글로벌비즈니스학전공/u, profile: PROFILE_2025_GLOBAL_BUSINESS, admissionYearFrom: 2025 },
  { pattern: /(?:화학나노학|융합에너지학|식품영양학|시스템생명과학)/u, profile: PROFILE_2025_CHEMISTRY_LIFE, admissionYearFrom: 2025 },
  { pattern: /(?:수학과|물리학과|화학나노학|융합에너지학|식품영양학|시스템생명과학|화학과|생명과학정보학)/u, profile: PROFILE_2018_2024_NATURAL_SCIENCE, admissionYearFrom: 2018, admissionYearTo: 2024 },
  { pattern: /(?:화학공학전공|신소재공학전공)/u, profile: PROFILE_2025_CHEMICAL_MATERIAL, admissionYearFrom: 2025 },
  { pattern: /건설환경공학전공/u, profile: PROFILE_2025_SMART_INFRA_CONSTRUCTION_ENVIRONMENT, admissionYearFrom: 2025 },
  { pattern: /환경시스템공학전공/u, profile: PROFILE_2025_SMART_INFRA_ENVIRONMENT_SYSTEM, admissionYearFrom: 2025 },
  { pattern: /스마트모빌리티공학전공/u, profile: PROFILE_2025_SMART_MOBILITY, admissionYearFrom: 2025 },
  { pattern: /산업경영공학과/u, profile: PROFILE_2025_INDUSTRIAL_MANAGEMENT, admissionYearFrom: 2025 },
  { pattern: /(?:비주얼커뮤니케이션디자인|인더스트리얼디자인|영상애니메이션디자인|패션디자인|스포츠학|체육학|스포츠산업학|스포츠지도학|건반음악|보컬뮤직|작곡|연극·영화|뮤지컬공연|디자인학부|스포츠학부|아트앤멀티미디어음악학부|공연예술학부|바둑학과)/u, profile: PROFILE_2025_SPORTS_ARTS, admissionYearFrom: 2025 },
  { pattern: /(?:비주얼커뮤니케이션디자인|인더스트리얼디자인|영상애니메이션디자인|패션디자인|스포츠학|체육학|스포츠산업학|스포츠지도학|건반음악|보컬뮤직|작곡|연극·영화|뮤지컬공연|디자인학부|스포츠학부|아트앤멀티미디어음악학부|공연예술학부|바둑학과)/u, profile: PROFILE_2018_2024_SPORTS_ARTS, admissionYearFrom: 2018, admissionYearTo: 2024 },
  { pattern: /(?:^|\s)(?:건축학전공|공간디자인학과)$/u, profile: PROFILE_2025_ARCHITECTURE_SPACE, admissionYearFrom: 2025 },
  { pattern: /(?:^|\s)(?:건축학전공|공간디자인학과|공간디자인전공)$/u, profile: PROFILE_2018_2024_ARCHITECTURE_SPACE, admissionYearFrom: 2018, admissionYearTo: 2024 },
  { pattern: /전통건축/u, profile: PROFILE_2025_TRADITIONAL_ARCHITECTURE, admissionYearFrom: 2025 },
  { pattern: /전통건축/u, profile: PROFILE_2018_2024_TRADITIONAL_ARCHITECTURE, admissionYearFrom: 2018, admissionYearTo: 2024 },
];

export function graduationDepartmentCandidates(department: string, admissionYear?: number): string[] {
  const trimmed = department.replace(/\s+/gu, " ").trim();
  const withoutCode = trimmed.replace(/^\d+\s+/u, "").trim();
  const withoutNight = withoutCode.replace(/\s*\((?:야간|주간|계약학과)[^)]*\)\s*$/u, "").trim();
  const departmentCode = trimmed.match(/^(\d{5})(?:\s|$)/u)?.[1];
  const suffixMatch = withoutNight.match(/([^\s]+(?:전공|학과|학부))$/u);
  const lastToken = withoutNight.includes(" ")
    ? withoutNight.split(" ").at(-1)
    : undefined;

  return [
    trimmed,
    withoutCode,
    withoutNight,
    suffixMatch?.[1],
    lastToken,
    ...graduationDepartmentAliases(departmentCode, withoutNight),
    ...graduationProfileCandidates(departmentCode, withoutNight, admissionYear),
  ].filter((value): value is string => Boolean(value))
    .filter((value, index, values) => values.indexOf(value) === index);
}

function departmentCodeFromInput(value: string): string | undefined {
  return value.replace(/\s+/gu, " ").trim().match(/^(\d{5})(?:\s|$)/u)?.[1];
}

function isCatalogExcludedGraduationDepartmentQuery(
  department: string,
  admissionYear: number,
): boolean {
  const code = departmentCodeFromInput(department);
  if (!code) return false;
  if (NON_UNDERGRADUATE_CATALOG_DEPARTMENT_CODES.has(code)) return true;
  const admissionYearFrom = CATALOG_DEPARTMENT_ADMISSION_YEAR_FROM_BY_CODE.get(code);
  return admissionYearFrom != null && admissionYear < admissionYearFrom;
}

function graduationDepartmentAliases(
  departmentCode: string | undefined,
  departmentName: string,
): string[] {
  const aliases: string[] = [];
  if (departmentCode) {
    for (const [pattern, alias] of GRADUATION_DEPARTMENT_ALIASES_BY_CODE) {
      if (pattern.test(departmentCode)) aliases.push(alias);
    }
  }
  for (const [pattern, alias] of GRADUATION_DEPARTMENT_ALIASES_BY_TEXT) {
    if (pattern.test(departmentName)) aliases.push(alias);
  }
  return aliases;
}

function graduationProfileCandidates(
  departmentCode: string | undefined,
  departmentName: string,
  admissionYear?: number,
): string[] {
  const codeProfiles: string[] = [];
  if (departmentCode) {
    for (const candidate of GRADUATION_PROFILE_CANDIDATES_BY_CODE) {
      if (candidate.pattern.test(departmentCode) && graduationProfileApplies(candidate, admissionYear)) {
        codeProfiles.push(candidate.profile);
      }
    }
  }
  if (codeProfiles.length) return [...new Set(codeProfiles)];

  const profiles: string[] = [];
  for (const candidate of GRADUATION_PROFILE_CANDIDATES_BY_TEXT) {
    if (candidate.pattern.test(departmentName) && graduationProfileApplies(candidate, admissionYear)) {
      profiles.push(candidate.profile);
    }
  }
  return profiles;
}

function graduationProfileApplies(
  candidate: GraduationProfileCandidate,
  admissionYear: number | undefined,
): boolean {
  if (!admissionYear) return true;
  if (candidate.admissionYearFrom != null && admissionYear < candidate.admissionYearFrom) return false;
  if (candidate.admissionYearTo != null && admissionYear > candidate.admissionYearTo) return false;
  return true;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeRuleStatus(value: unknown): GraduationRequirementRuleStatus {
  return value === "confirmed" ? "confirmed" : "unprovided";
}

function recordFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function courseGroupArray(value: unknown): GraduationRequirementCourseGroup[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      groupKey: (item.groupKey as string | null) ?? (item.group_key as string | null) ?? null,
      label: (item.label as string | null) ?? "",
      requiredCredits: item.requiredCredits != null ? Number(item.requiredCredits) : item.required_credits != null ? Number(item.required_credits) : null,
      minCourses: item.minCourses != null ? Number(item.minCourses) : item.min_courses != null ? Number(item.min_courses) : null,
      requiredCourseCodes: stringArray(item.requiredCourseCodes ?? item.required_course_codes),
      requiredCourseTitles: stringArray(item.requiredCourseTitles ?? item.required_course_titles),
      groupType: (item.groupType as string | null) ?? (item.group_type as string | null) ?? null,
      alternativeGroup: (item.alternativeGroup as string | null) ?? (item.alternative_group as string | null) ?? null,
      ...optionalAppliesTo(item.appliesTo ?? item.applies_to),
      note: (item.note as string | null) ?? null,
    }));
}

function optionalAppliesTo(value: unknown): { appliesTo?: Record<string, unknown> } {
  const appliesTo = recordFrom(value);
  return Object.keys(appliesTo).length ? { appliesTo } : {};
}

function rowToRule(row: Record<string, unknown>): GraduationRequirementRule {
  return {
    requirementKey: row.requirement_key as string,
    label: row.label as string,
    category: row.category as string,
    requiredCredits: row.required_credits != null ? Number(row.required_credits) : null,
    requiredCourseCodes: stringArray(row.required_course_codes),
    requiredCourseTitles: stringArray(row.required_course_titles),
    courseGroups: courseGroupArray(row.course_groups),
    programTrack: (row.program_track as string | null) ?? null,
    minCourses: row.min_courses != null ? Number(row.min_courses) : null,
    appliesTo: recordFrom(row.applies_to),
    status: normalizeRuleStatus(row.rule_status),
    note: (row.note as string | null) ?? null,
  };
}

function numberFrom(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function stringFrom(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function termRank(value: string): number | null {
  const match = value.match(/^((?:19|20)\d{2})-(0[1-9]|1[0-2])$/);
  if (!match) return null;
  return Number(match[1]) * 100 + Number(match[2]);
}

function ruleAppliesToStudent(
  rule: GraduationRequirementRule,
  opts: ListGraduationRequirementOpts,
): boolean {
  return appliesToStudent(rule.appliesTo, opts);
}

function appliesToStudent(
  appliesTo: Record<string, unknown>,
  opts: ListGraduationRequirementOpts,
): boolean {
  const requiredStudentType = stringFrom(appliesTo.studentType ?? appliesTo.student_type);
  if (requiredStudentType && requiredStudentType !== (opts.studentType ?? "domestic")) return false;
  if (!departmentAppliesToStudent(appliesTo, opts.department)) return false;

  const admissionYearFrom = numberFrom(appliesTo.admissionYearFrom ?? appliesTo.admission_year_from);
  if (admissionYearFrom != null && opts.admissionYear < admissionYearFrom) return false;
  const admissionYearTo = numberFrom(appliesTo.admissionYearTo ?? appliesTo.admission_year_to);
  if (admissionYearTo != null && opts.admissionYear > admissionYearTo) return false;

  if (!opts.expectedGraduationTerm) return true;
  const expectedRank = termRank(opts.expectedGraduationTerm);
  if (expectedRank == null) return true;

  const graduationTermFrom = stringFrom(appliesTo.graduationTermFrom ?? appliesTo.graduation_term_from);
  const graduationTermFromRank = graduationTermFrom ? termRank(graduationTermFrom) : null;
  if (graduationTermFromRank != null && expectedRank < graduationTermFromRank) return false;

  const graduationTermTo = stringFrom(appliesTo.graduationTermTo ?? appliesTo.graduation_term_to);
  const graduationTermToRank = graduationTermTo ? termRank(graduationTermTo) : null;
  if (graduationTermToRank != null && expectedRank > graduationTermToRank) return false;

  return true;
}

function departmentAppliesToStudent(appliesTo: Record<string, unknown>, department: string): boolean {
  const normalized = department.replace(/\s+/gu, " ").trim();
  const includes = stringArray(appliesTo.departmentPatterns ?? appliesTo.department_patterns);
  const excludes = stringArray(appliesTo.departmentExcludes ?? appliesTo.department_excludes);
  if (includes.length && !includes.some((pattern) => safePatternTest(pattern, normalized))) return false;
  if (excludes.some((pattern) => safePatternTest(pattern, normalized))) return false;
  return true;
}

function safePatternTest(pattern: string, value: string): boolean {
  try {
    return new RegExp(pattern, "u").test(value);
  } catch {
    return value.includes(pattern);
  }
}

function courseGroupAppliesToStudent(
  group: GraduationRequirementCourseGroup,
  opts: ListGraduationRequirementOpts,
): boolean {
  return appliesToStudent(group.appliesTo ?? {}, opts);
}

function sourceAppliesToAdmissionYear(
  source: GraduationRequirementSource,
  admissionYear: number,
): boolean {
  const range = sourceCohortRange(source);
  if (range) return cohortRangeApplies(range, admissionYear);
  return source.admissionYear <= admissionYear;
}

function sourceCohortRange(source: GraduationRequirementSource): { from?: number; to?: number } | null {
  return cohortRangeFromText([
    source.department,
    source.sourceTitle,
  ].filter(Boolean).join(" "));
}

function cohortRangeFromText(value: string): { from?: number; to?: number } | null {
  const range = value.match(/\b((?:19|20)\d{2})\s*[-~\u2013\u2014]\s*((?:19|20)\d{2})\b/u);
  if (range) {
    return {
      from: Number(range[1]),
      to: Number(range[2]),
    };
  }

  const openEnded = value.match(/\b((?:19|20)\d{2})\s*\+/u);
  return openEnded ? { from: Number(openEnded[1]) } : null;
}

function cohortRangeApplies(
  range: { from?: number; to?: number },
  admissionYear: number,
): boolean {
  if (range.from != null && admissionYear < range.from) return false;
  if (range.to != null && admissionYear > range.to) return false;
  return true;
}

function sourceCohortKey(source: GraduationRequirementSource): string {
  return source.department.replace(/\s+/gu, " ").trim();
}

function ruleCohortKey(
  source: GraduationRequirementSource,
  rule: GraduationRequirementRule,
): string {
  const ruleKey = (rule.category || rule.label || rule.requirementKey).replace(/\s+/gu, " ").trim();
  return `${sourceCohortKey(source)}\u0000${ruleKey}`;
}

function preferLatestRulesByCohort(
  sources: GraduationRequirementSource[],
): GraduationRequirementSource[] {
  const latestByRule = new Map<string, number>();

  for (const source of sources) {
    for (const rule of source.rules) {
      const key = ruleCohortKey(source, rule);
      const previous = latestByRule.get(key);
      if (previous == null || source.admissionYear > previous) {
        latestByRule.set(key, source.admissionYear);
      }
    }
  }

  return sources
    .map((source) => ({
      ...source,
      rules: source.rules.filter((rule) => {
        const latest = latestByRule.get(ruleCohortKey(source, rule));
        return latest == null || source.admissionYear === latest;
      }),
    }))
    .filter((source) => source.rules.length > 0);
}

function suppressShadowedUnprovidedRules(
  sources: GraduationRequirementSource[],
  departmentCandidates: string[],
): GraduationRequirementSource[] {
  const confirmedPriorityByRule = new Map<string, number>();
  const unprovidedPriorityByRule = new Map<string, number>();

  for (const source of sources) {
    for (const rule of source.rules) {
      const priority = rulePriority(source.department, rule, departmentCandidates);
      const key = ruleShadowKey(rule);
      if (rule.status === "unprovided") {
        const previous = unprovidedPriorityByRule.get(key);
        if (previous == null || priority < previous) unprovidedPriorityByRule.set(key, priority);
        continue;
      }
      const previous = confirmedPriorityByRule.get(key);
      if (previous == null || priority < previous) confirmedPriorityByRule.set(key, priority);
    }
  }

  return sources
    .map((source) => {
      return {
        ...source,
        rules: source.rules.filter((rule) => {
          const priority = rulePriority(source.department, rule, departmentCandidates);
          if (rule.status !== "unprovided") return true;
          const key = ruleShadowKey(rule);
          const confirmedPriority = confirmedPriorityByRule.get(key);
          if (confirmedPriority != null && confirmedPriority <= priority) return false;
          return unprovidedPriorityByRule.get(key) === priority;
        }),
      };
    })
    .filter((source) => source.rules.length > 0);
}

function rulePriority(
  department: string,
  rule: GraduationRequirementRule,
  departmentCandidates: string[],
): number {
  const priority = sourcePriority(department, departmentCandidates);
  return priority >= 100_000 && ruleHasDepartmentScope(rule) ? 0 : priority;
}

function ruleHasDepartmentScope(rule: GraduationRequirementRule): boolean {
  return stringArray(rule.appliesTo?.departmentPatterns ?? rule.appliesTo?.department_patterns).length > 0 ||
    stringArray(rule.appliesTo?.departmentExcludes ?? rule.appliesTo?.department_excludes).length > 0;
}

function ruleShadowKey(rule: GraduationRequirementRule): string {
  return [normalizedRuleShadowToken(rule.category), normalizedRuleShadowToken(rule.label)]
    .filter(Boolean)
    .join("\u0000") || rule.requirementKey;
}

function normalizedRuleShadowToken(value: string | undefined): string {
  const normalized = (value ?? "").replace(/\s+/gu, "").trim();
  if (normalized === "전공필수과목") return "전공필수";
  return normalized;
}

function sourcePriority(department: string, departmentCandidates: string[]): number {
  const normalized = department.replace(/\s+/gu, " ").trim();
  const candidateIndex = departmentCandidates
    .map((candidate) => candidate.replace(/\s+/gu, " ").trim())
    .indexOf(normalized);
  if (candidateIndex >= 0) return candidateIndex;
  if (UNIVERSAL_GRADUATION_REQUIREMENT_DEPARTMENTS.includes(normalized)) return 1_000_000;
  return 100_000;
}

function applyRequirementContext(
  sources: GraduationRequirementSource[],
  opts: ListGraduationRequirementOpts,
): GraduationRequirementSource[] {
  const departmentCandidates = graduationDepartmentCandidates(opts.department, opts.admissionYear);
  const applicable = sources.filter((source) => sourceAppliesToAdmissionYear(source, opts.admissionYear));
  const latest = preferLatestRulesByCohort(applicable.map((source) => ({
    ...source,
    rules: source.rules
      .filter((rule) => ruleAppliesToStudent(rule, opts))
      .map((rule) => ({
        ...rule,
        courseGroups: rule.courseGroups.filter((group) => courseGroupAppliesToStudent(group, opts)),
      })),
  })).filter((source) => source.rules.length > 0));
  return suppressShadowedUnprovidedRules(latest, departmentCandidates);
}

export async function listGraduationRequirementSources(
  pool: Pool,
  opts: ListGraduationRequirementOpts,
): Promise<GraduationRequirementSource[]> {
  if (isCatalogExcludedGraduationDepartmentQuery(opts.department, opts.admissionYear)) return [];

  const departmentCandidates = graduationDepartmentCandidates(opts.department, opts.admissionYear);
  const lookupDepartments = [
    ...departmentCandidates,
    ...UNIVERSAL_GRADUATION_REQUIREMENT_DEPARTMENTS,
  ];
  const res = await pool.query(
    `
      WITH candidate_sources AS (
        SELECT
          s.*,
          ROW_NUMBER() OVER (
            PARTITION BY s.department, s.source_url
            ORDER BY s.admission_year DESC, s.source_retrieved_at DESC, s.id DESC
          ) AS source_rank
        FROM graduation_requirement_sources s
        WHERE (
            s.department = ANY($2::text[])
            OR EXISTS (
              SELECT 1
              FROM graduation_requirement_rules scoped
              WHERE scoped.source_id = s.id
                AND (
                  jsonb_typeof(scoped.applies_to->'departmentPatterns') = 'array'
                  OR jsonb_typeof(scoped.applies_to->'department_patterns') = 'array'
                  OR jsonb_typeof(scoped.applies_to->'departmentExcludes') = 'array'
                  OR jsonb_typeof(scoped.applies_to->'department_excludes') = 'array'
                )
            )
          )
          AND s.admission_year <= $1
      )
      SELECT
        s.id AS source_id,
        s.department,
        s.admission_year,
        s.source_kind,
        s.source_title,
        s.source_url,
        s.source_published_at,
        s.source_retrieved_at,
        r.requirement_key,
        r.label,
        r.category,
        r.required_credits,
        r.required_course_codes,
        r.required_course_titles,
        r.course_groups,
        r.program_track,
        r.min_courses,
        r.applies_to,
        r.rule_status,
        r.note
      FROM candidate_sources s
      LEFT JOIN graduation_requirement_rules r ON r.source_id = s.id
      WHERE s.source_rank = 1
      ORDER BY
        CASE WHEN s.department = ANY($3::text[]) THEN 0 ELSE 1 END,
        s.source_retrieved_at DESC,
        r.category ASC NULLS LAST,
        r.requirement_key ASC NULLS LAST
    `,
    [opts.admissionYear, lookupDepartments, departmentCandidates],
  );

  const sources = new Map<number, GraduationRequirementSource>();
  for (const row of res.rows as Record<string, unknown>[]) {
    const sourceId = Number(row.source_id);
    const source = sources.get(sourceId) ?? {
      id: sourceId,
      department: row.department as string,
      admissionYear: Number(row.admission_year),
      sourceKind: row.source_kind as string,
      sourceTitle: row.source_title as string,
      sourceUrl: row.source_url as string,
      sourcePublishedAt: (row.source_published_at as string | null) ?? null,
      sourceRetrievedAt: row.source_retrieved_at as string,
      rules: [],
    };
    if (row.requirement_key) {
      source.rules.push(rowToRule(row));
    }
    sources.set(sourceId, source);
  }

  return applyRequirementContext([...sources.values()], opts);
}
