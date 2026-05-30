import { readFile } from "node:fs/promises";
import { Command } from "commander";
import { closePool, getPool } from "../db/client.js";
import {
  listCourseCatalogDiagnostics,
  listCourseCatalogEntries,
} from "../db/course-catalog.js";
import { listGraduationRequirementSources } from "../db/graduation-requirements.js";
import { printData } from "../output/print.js";
import type {
  CourseCatalogDiagnostics,
  CourseCatalogEntry,
  GraduationRequirementCourseGroup,
  GraduationRequirementSource,
  ListResult,
} from "../types.js";
import { readGlobalOptions } from "./common.js";
import {
  buildCourseCatalogDiagnosticsFromExport,
  buildCourseCatalogListResult,
  listCourseCatalogEntriesFromExport,
  parseCatalogYear,
  resolveCatalogJsonPath,
  validateCatalogDepartment,
  validateTermCode,
} from "./course-catalog.js";
import {
  buildGraduationRequirementListResult,
  graduationRequirementUnavailableReason,
  listGraduationRequirementSourcesFromSeeds,
  readRequirementSeeds,
  resolveAdmissionYearForGraduationQuery,
  validateDepartment,
  validateGraduationTerm,
  validateStudentNumber,
  validateStudentType,
} from "./graduation-requirements.js";

export interface AcademicRequirementChoiceOption {
  key: string;
  label: string;
  courseTitles: string[];
  courseCodes: string[];
  requirementKeys: string[];
  courseGroupKeys: string[];
  note?: string;
}

export interface AcademicRequirementChoiceGroup {
  key: string;
  label: string;
  required: boolean;
  appliesToView: "both";
  sourceTitle: string;
  sourceUrl: string;
  options: AcademicRequirementChoiceOption[];
}

export type AcademicRequirementChoiceSelections = Record<string, string>;

export interface AcademicOfficialCoverage {
  status: "confirmed" | "needs-official-check";
  reason?: string;
}

export interface AcademicPlanningDataReadiness {
  target: "course-catalog" | "graduation-requirements";
  status: "ready" | "empty";
  count: number;
  scope: Record<string, unknown>;
  message?: string;
}

export interface AcademicCompletedCourse {
  courseTitle: string;
  courseCode?: string;
  credits?: number;
  category?: string;
  termLabel?: string;
  grade?: string;
}

export type AcademicTimetablePlanningResult = ListResult<CourseCatalogEntry> & {
  departmentLabel?: string;
  studentStanding?: string;
  requirementSources: GraduationRequirementSource[];
  graduationRequirementSources: GraduationRequirementSource[];
  choiceGroups: AcademicRequirementChoiceGroup[];
  selectedChoiceKeys: AcademicRequirementChoiceSelections;
  timetableSelectedChoiceKeys: AcademicRequirementChoiceSelections;
  completedCourses: AcademicCompletedCourse[];
  currentCourses: AcademicCompletedCourse[];
  courseCatalogDiagnostics: CourseCatalogDiagnostics;
  dataReadiness: AcademicPlanningDataReadiness[];
  officialRequirementCoverage: AcademicOfficialCoverage;
  officialCoverage: AcademicOfficialCoverage;
  automaticPlanningApplied: boolean;
};

export type AcademicGraduationRoadmapResult = Record<string, unknown> & {
  departmentLabel?: string;
  studentStanding?: string;
  total: number;
  items: GraduationRequirementSource[];
  requirementSources: GraduationRequirementSource[];
  graduationRequirementSources: GraduationRequirementSource[];
  choiceGroups: AcademicRequirementChoiceGroup[];
  selectedChoiceKeys: AcademicRequirementChoiceSelections;
  graduationSelectedChoiceKeys: AcademicRequirementChoiceSelections;
  completedCourses: AcademicCompletedCourse[];
  currentCourses: AcademicCompletedCourse[];
  dataReadiness: AcademicPlanningDataReadiness[];
  officialRequirementCoverage: AcademicOfficialCoverage;
  officialCoverage: AcademicOfficialCoverage;
  automaticPlanningApplied: boolean;
  query: Record<string, unknown>;
};

interface AcademicRequirementQuery {
  department: string;
  admissionYear: number;
  studentNumberProvided?: boolean;
  studentType?: "domestic" | "foreign";
  expectedGraduationTerm?: string;
}

interface AcademicPersonalInputs {
  completedCourses: AcademicCompletedCourse[];
  currentCourses: AcademicCompletedCourse[];
  msiGraduation?: Record<string, unknown>;
  studentInfo?: Record<string, unknown>;
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

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(stringValue).filter(Boolean)
    : [];
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

async function readJson(pathname: string | undefined): Promise<unknown> {
  if (!pathname) return undefined;
  return JSON.parse((await readFile(pathname, "utf8")).replace(/^\uFEFF/u, ""));
}

function directCourseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = recordFrom(value);
  for (const key of ["completedCourses", "completedCourseTitles", "takenCourses", "items", "courses", "allRows"]) {
    const items = record[key];
    if (Array.isArray(items)) return items;
  }
  return [];
}

function academicTermLabelFromRecord(record: Record<string, unknown>, fallback?: string): string {
  const termLabel = stringValue(record.termLabel ?? record.term ?? record.label ?? fallback);
  const year = numberValue(record.year ?? record.termYear ?? record.academicYear);
  if (!termLabel) return year != null ? String(year) : "";
  if (year == null || termLabel.includes(String(year))) return termLabel;
  return `${year} ${termLabel}`;
}

function normalizeCourseRow(value: unknown, termLabel?: string): AcademicCompletedCourse | undefined {
  if (typeof value === "string") {
    const courseTitle = stringValue(value);
    return courseTitle ? { courseTitle, ...(termLabel ? { termLabel } : {}) } : undefined;
  }
  const record = recordFrom(value);
  const courseTitle = stringValue(record.courseTitle ?? record.title ?? record.subjectName ?? record.subject_name ?? record.name);
  const courseCode = stringValue(record.courseCode ?? record.code ?? record.curiNum ?? record.curriculumNumber);
  const resolvedTermLabel = academicTermLabelFromRecord(record, termLabel);
  if (!courseTitle && !courseCode) return undefined;
  return {
    courseTitle: courseTitle || courseCode,
    ...(courseCode ? { courseCode } : {}),
    ...(numberValue(record.credits ?? record.credit) != null ? { credits: numberValue(record.credits ?? record.credit) } : {}),
    ...(stringValue(record.category ?? record.categoryLabel) ? { category: stringValue(record.category ?? record.categoryLabel) } : {}),
    ...(resolvedTermLabel ? { termLabel: resolvedTermLabel } : {}),
    ...(stringValue(record.grade) ? { grade: stringValue(record.grade) } : {}),
  };
}

export function normalizeCompletedCoursesFromMsi(value: unknown): AcademicCompletedCourse[] {
  const courses: AcademicCompletedCourse[] = [];
  const push = (course: unknown, termLabel?: string) => {
    const normalized = normalizeCourseRow(course, termLabel);
    if (normalized) courses.push(normalized);
  };

  const record = recordFrom(value);
  if (Array.isArray(record.termRecords)) {
    for (const term of record.termRecords) {
      const termRecord = recordFrom(term);
      const termLabel = academicTermLabelFromRecord(termRecord);
      for (const course of directCourseArray(termRecord)) push(course, termLabel);
    }
  }

  for (const course of directCourseArray(value)) push(course);

  return dedupeCompletedCourses(courses);
}

function dedupeCompletedCourses(courses: AcademicCompletedCourse[]): AcademicCompletedCourse[] {
  const seen = new Set<string>();
  return courses.filter((course) => {
    const key = `${course.courseCode ?? ""}\u0000${course.courseTitle}\u0000${course.termLabel ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function graduationCompletedCoursesFromCreditGaps(value: unknown): AcademicCompletedCourse[] {
  const root = recordFrom(value);
  const creditGaps = Array.isArray(root.creditGaps) ? root.creditGaps : [];
  const courses: AcademicCompletedCourse[] = [];
  for (const section of creditGaps) {
    const sectionRecord = recordFrom(section);
    for (const key of ["detailCourses", "completedCourses", "completedRequiredCourses"]) {
      const rows = sectionRecord[key];
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        const record = recordFrom(row);
        const status = stringValue(record.status).toLowerCase();
        if (status && status !== "completed" && status !== "done" && status !== "이수") continue;
        const normalized = normalizeCourseRow(row);
        if (normalized) courses.push(normalized);
      }
    }
  }
  return dedupeCompletedCourses(courses);
}

function unwrapRawData(value: unknown): unknown {
  const record = recordFrom(value);
  return record.rawData && typeof record.rawData === "object" && !Array.isArray(record.rawData)
    ? record.rawData
    : value;
}

function firstRecord(...values: unknown[]): Record<string, unknown> | undefined {
  for (const value of values) {
    const record = recordFrom(value);
    if (Object.keys(record).length) return record;
  }
  return undefined;
}

function departmentDisplayName(
  requestedDepartment: string,
  items: CourseCatalogEntry[],
  sources: GraduationRequirementSource[],
  personal: AcademicPersonalInputs,
): string | undefined {
  const studentDepartment = stringValue(
    personal.studentInfo?.department
      ?? personal.studentInfo?.dept
      ?? personal.studentInfo?.["학과"],
  );
  if (studentDepartment) return stripDepartmentCode(studentDepartment);

  const requestedCode = requestedDepartment.match(/^\d{5}/u)?.[0];
  const catalogDepartment = requestedCode
    ? items.map((item) => item.department).find((department) => department?.startsWith(`${requestedCode} `))
    : items.map((item) => item.department).find((department) => department === requestedDepartment);
  const sourceDepartment = sources.find((source) => stringValue(source.department))?.department;
  const raw = catalogDepartment || sourceDepartment || requestedDepartment;
  return raw ? stripDepartmentCode(raw) : undefined;
}

function stripDepartmentCode(value: string): string {
  return value.replace(/^\d{5}\s+/u, "").trim();
}

function termCodeLabel(termCode?: string): string | undefined {
  if (!termCode) return undefined;
  if (termCode === "10" || termCode === "1") return "1학기";
  if (termCode === "20" || termCode === "2") return "2학기";
  if (termCode === "15" || termCode === "3") return "하계";
  if (termCode === "25" || termCode === "4") return "동계";
  return undefined;
}

function studentStandingLabel(args: {
  year?: number;
  termCode?: string;
  admissionYear: number;
}, personal: AcademicPersonalInputs): string | undefined {
  const grade = numberValue(personal.studentInfo?.grade ?? personal.studentInfo?.["학년"]);
  const completedTerms = numberValue(personal.studentInfo?.completedTerms ?? personal.studentInfo?.["이수학기"]);
  const computedGrade = args.year ? args.year - args.admissionYear + 1 : undefined;
  const safeGrade = grade ?? (
    computedGrade != null && computedGrade >= 1 && computedGrade <= 8 ? computedGrade : undefined
  );
  const termLabel = termCodeLabel(args.termCode);
  if (safeGrade != null && termLabel) return `${safeGrade}학년 ${termLabel}`;
  if (safeGrade != null) return `${safeGrade}학년`;
  if (completedTerms != null) return `이수학기 ${completedTerms}학기`;
  return undefined;
}

function choiceGroupLabel(ruleLabel: string, groupKey: string): string {
  if (/conversation/i.test(groupKey)) return "영어회화";
  if (/english/i.test(groupKey)) return "영어";
  if (/korean-practice/i.test(groupKey)) return "한국어연습";
  if (/korean/i.test(groupKey)) return "한국어";
  return ruleLabel;
}

function optionFromCourseGroup(
  group: GraduationRequirementCourseGroup,
  ruleKey: string,
  fallbackKey: string,
): AcademicRequirementChoiceOption | undefined {
  const courseTitles = group.requiredCourseTitles.filter(Boolean);
  const courseCodes = group.requiredCourseCodes.filter(Boolean);
  if (!courseTitles.length && !courseCodes.length) return undefined;
  const base = group.groupKey || group.label || courseTitles[0] || courseCodes[0] || fallbackKey;
  return {
    key: slug(base) || fallbackKey,
    label: group.label || courseTitles.join(", ") || courseCodes.join(", "),
    courseTitles,
    courseCodes,
    requirementKeys: [ruleKey],
    courseGroupKeys: group.groupKey ? [group.groupKey] : [],
    ...(group.note ? { note: group.note } : {}),
  };
}

function combineChoiceOption(
  key: string,
  label: string,
  ruleKey: string,
  groups: GraduationRequirementCourseGroup[],
): AcademicRequirementChoiceOption | undefined {
  const courseTitles = [...new Set(groups.flatMap((group) => group.requiredCourseTitles).filter(Boolean))];
  const courseCodes = [...new Set(groups.flatMap((group) => group.requiredCourseCodes).filter(Boolean))];
  if (!courseTitles.length && !courseCodes.length) return undefined;
  const courseGroupKeys = [...new Set(groups.map((group) => group.groupKey).filter((value): value is string => Boolean(value)))];
  const note = [...new Set(groups.map((group) => group.note).filter((value): value is string => Boolean(value)))].join(" / ");
  return {
    key,
    label,
    courseTitles,
    courseCodes,
    requirementKeys: [ruleKey],
    courseGroupKeys,
    ...(note ? { note } : {}),
  };
}

function buildEnglishConversationChoiceGroup(
  source: GraduationRequirementSource,
  rule: GraduationRequirementSource["rules"][number],
  alternatives: Map<string, GraduationRequirementCourseGroup[]>,
): AcademicRequirementChoiceGroup | undefined {
  const englishGroups = alternatives.get("english-sequence") ?? [];
  const conversationGroups = alternatives.get("conversation-sequence") ?? [];
  if (englishGroups.length < 2 || conversationGroups.length < 2) return undefined;

  const find = (groups: GraduationRequirementCourseGroup[], suffix: "basic" | "advanced") =>
    groups.find((group) => (group.groupKey ?? "").toLowerCase().includes(suffix));
  const englishBasic = find(englishGroups, "basic");
  const englishAdvanced = find(englishGroups, "advanced");
  const conversationBasic = find(conversationGroups, "basic");
  const conversationAdvanced = find(conversationGroups, "advanced");
  if (!englishBasic || !englishAdvanced || !conversationBasic || !conversationAdvanced) return undefined;

  const options = [
    combineChoiceOption("english-conversation-basic", "영어 및 영어회화 1,2", rule.requirementKey, [englishBasic, conversationBasic]),
    combineChoiceOption("english-conversation-advanced", "영어 및 영어회화 3,4", rule.requirementKey, [englishAdvanced, conversationAdvanced]),
  ].filter((option): option is AcademicRequirementChoiceOption => Boolean(option));
  if (options.length < 2) return undefined;

  return {
    key: slug(`${rule.requirementKey}-english-conversation-sequence`) || "english-conversation-sequence",
    label: "영어 및 영어회화",
    required: true,
    appliesToView: "both",
    sourceTitle: source.sourceTitle,
    sourceUrl: source.sourceUrl,
    options,
  };
}

export function buildRequirementChoiceGroupsFromSources(
  sources: GraduationRequirementSource[],
): AcademicRequirementChoiceGroup[] {
  const byKey = new Map<string, AcademicRequirementChoiceGroup>();

  for (const source of sources) {
    for (const rule of source.rules ?? []) {
      const alternatives = new Map<string, GraduationRequirementCourseGroup[]>();
      for (const group of rule.courseGroups ?? []) {
        if (group.groupType === "alternative" && group.alternativeGroup) {
          alternatives.set(group.alternativeGroup, [...(alternatives.get(group.alternativeGroup) ?? []), group]);
        }
      }

      const groupedEnglishConversation = buildEnglishConversationChoiceGroup(source, rule, alternatives);
      if (groupedEnglishConversation && !byKey.has(groupedEnglishConversation.key)) {
        byKey.set(groupedEnglishConversation.key, groupedEnglishConversation);
      }

      for (const [alternativeKey, groups] of alternatives) {
        if (groupedEnglishConversation && (alternativeKey === "english-sequence" || alternativeKey === "conversation-sequence")) {
          continue;
        }
        const options = groups
          .map((group, index) => optionFromCourseGroup(group, rule.requirementKey, `${slug(alternativeKey)}-${index + 1}`))
          .filter((option): option is AcademicRequirementChoiceOption => Boolean(option));
        if (options.length < 2) continue;
        const key = slug(`${rule.requirementKey}-${alternativeKey}`) || `choice-${byKey.size + 1}`;
        if (!byKey.has(key)) {
          byKey.set(key, {
            key,
            label: choiceGroupLabel(rule.label, alternativeKey),
            required: true,
            appliesToView: "both",
            sourceTitle: source.sourceTitle,
            sourceUrl: source.sourceUrl,
            options,
          });
        }
      }

      for (const group of rule.courseGroups ?? []) {
        if (group.groupType !== "choice") continue;
        const titles = group.requiredCourseTitles.filter(Boolean);
        const codes = group.requiredCourseCodes.filter(Boolean);
        if (titles.length + codes.length < 2) continue;
        const key = slug(`${rule.requirementKey}-${group.groupKey || group.label}`) || `choice-${byKey.size + 1}`;
        if (byKey.has(key)) continue;
        const options = [...titles, ...codes].map((course, index) => ({
          key: slug(`${group.groupKey || group.label}-${course}`) || `${key}-${index + 1}`,
          label: course,
          courseTitles: titles.includes(course) ? [course] : [],
          courseCodes: codes.includes(course) ? [course] : [],
          requirementKeys: [rule.requirementKey],
          courseGroupKeys: group.groupKey ? [group.groupKey] : [],
          ...(group.note ? { note: group.note } : {}),
        }));
        byKey.set(key, {
          key,
          label: group.label || rule.label,
          required: true,
          appliesToView: "both",
          sourceTitle: source.sourceTitle,
          sourceUrl: source.sourceUrl,
          options,
        });
      }
    }
  }

  return [...byKey.values()];
}

function requirementChoiceMatchKey(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "")
    .trim()
    .toLowerCase();
}

function inferRequirementChoiceSelections(
  groups: AcademicRequirementChoiceGroup[],
  courses: AcademicCompletedCourse[],
): AcademicRequirementChoiceSelections {
  const completedKeys = new Set<string>();
  for (const course of courses) {
    if (course.courseTitle) completedKeys.add(requirementChoiceMatchKey(course.courseTitle));
    if (course.courseCode) completedKeys.add(requirementChoiceMatchKey(course.courseCode));
  }

  const selected: AcademicRequirementChoiceSelections = {};
  for (const group of groups) {
    let bestOption: AcademicRequirementChoiceOption | undefined;
    let bestScore = 0;
    for (const option of group.options) {
      const optionKeys = [
        ...option.courseTitles,
        ...option.courseCodes,
      ].map(requirementChoiceMatchKey);
      const score = optionKeys.filter((key) => completedKeys.has(key)).length;
      if (score > bestScore) {
        bestOption = option;
        bestScore = score;
      }
    }
    if (bestOption && bestScore > 0) selected[group.key] = bestOption.key;
  }
  return selected;
}

function officialCoverage(
  sources: GraduationRequirementSource[],
  query: AcademicRequirementQuery,
): AcademicOfficialCoverage {
  if (sources.length) return { status: "confirmed" };
  return {
    status: "needs-official-check",
    reason: graduationRequirementUnavailableReason(query.department, query.admissionYear),
  };
}

function readinessCheck(args: {
  target: AcademicPlanningDataReadiness["target"];
  count: number;
  scope: Record<string, unknown>;
}): AcademicPlanningDataReadiness {
  if (args.count > 0) {
    return {
      target: args.target,
      status: "ready",
      count: args.count,
      scope: args.scope,
    };
  }

  const message = args.target === "course-catalog"
    ? "No course catalog rows matched the requested year, term, and department. Verify public-data course catalog import."
    : "No graduation requirement rows matched the requested department and admission year. Verify public-data graduation requirement import.";
  return {
    target: args.target,
    status: "empty",
    count: 0,
    scope: args.scope,
    message,
  };
}

function academicPlanningDbError(target: AcademicPlanningDataReadiness["target"], error: unknown): Error {
  const record = recordFrom(error);
  const code = stringValue(record.code);
  const relation = stringValue(record.relation);
  const originalMessage = error instanceof Error ? error.message : stringValue(error);
  const tableHint = relation ? ` relation=${relation}` : "";
  const reason = code === "42P01"
    ? "required public-data table is missing; run migrations before academic planning reads"
    : "public-data DB read failed";
  return new Error(
    `academic-planning ${target} preflight failed: ${reason}${tableHint}${code ? ` code=${code}` : ""}${originalMessage ? ` message=${originalMessage}` : ""}`,
  );
}

function requirementListQuery(query: AcademicRequirementQuery) {
  return {
    department: query.department,
    admissionYear: query.admissionYear,
    ...(query.expectedGraduationTerm ? { expectedGraduationTerm: query.expectedGraduationTerm } : {}),
    ...(query.studentType ? { studentType: query.studentType } : {}),
    ...(query.studentNumberProvided ? { studentNumberProvided: true } : {}),
  };
}

async function loadRequirementSources(
  query: AcademicRequirementQuery,
  requirementsDir?: string,
): Promise<GraduationRequirementSource[]> {
  if (requirementsDir) {
    return listGraduationRequirementSourcesFromSeeds(
      await readRequirementSeeds(requirementsDir),
      requirementListQuery(query),
    );
  }

  const pool = getPool();
  try {
    return await listGraduationRequirementSources(pool, requirementListQuery(query));
  } catch (error) {
    throw academicPlanningDbError("graduation-requirements", error);
  } finally {
    await closePool();
  }
}

function courseCatalogDiagnosticsFallback(
  args: {
    year: number;
    termCode: string;
    department: string;
  },
  stage: string,
  error: unknown,
): CourseCatalogDiagnostics {
  const message = error instanceof Error ? error.message : stringValue(error);
  return {
    generatedAt: new Date().toISOString(),
    source: "fallback",
    scope: {
      year: args.year,
      termCode: args.termCode,
      department: args.department,
    },
    departmentCandidates: [],
    stages: [
      {
        key: stage,
        label: "진단 생성 실패",
        count: 0,
        status: "error",
        message: message || "unknown diagnostic error",
      },
    ],
    categoryCounts: {
      allTerm: [],
      departmentMatched: [],
      readerOutput: [],
    },
    departmentCounts: {
      allTerm: [],
      departmentMatched: [],
      readerOutput: [],
    },
    hints: ["개설강좌 진단 숫자를 만들지 못했습니다. 본 기능 결과와 별도로 진단 생성 단계만 확인해야 합니다."],
    error: {
      stage,
      message: message || "unknown diagnostic error",
    },
  };
}

async function loadCourseCatalogBundle(args: {
  year: number;
  termCode: string;
  department: string;
  catalogJson?: string;
}): Promise<{
  items: CourseCatalogEntry[];
  diagnostics: CourseCatalogDiagnostics;
}> {
  const query = {
    year: args.year,
    termCode: args.termCode,
    department: args.department,
  };
  if (args.catalogJson) {
    const catalog = await readJson(args.catalogJson);
    const items = listCourseCatalogEntriesFromExport(catalog, query);
    try {
      return {
        items,
        diagnostics: buildCourseCatalogDiagnosticsFromExport(catalog, query, items),
      };
    } catch (error) {
      return {
        items,
        diagnostics: courseCatalogDiagnosticsFallback(args, "catalog-json.diagnostics", error),
      };
    }
  }

  const pool = getPool();
  try {
    const items = await listCourseCatalogEntries(pool, query);
    let diagnostics: CourseCatalogDiagnostics;
    try {
      diagnostics = await listCourseCatalogDiagnostics(pool, query, items);
    } catch (error) {
      diagnostics = courseCatalogDiagnosticsFallback(args, "db.diagnostics", error);
    }
    return { items, diagnostics };
  } catch (error) {
    throw academicPlanningDbError("course-catalog", error);
  } finally {
    await closePool();
  }
}

async function loadPersonalInputs(args: {
  personalMsiJson?: string;
  completedCoursesJson?: string;
  currentCoursesJson?: string;
  msiGraduationJson?: string;
}): Promise<AcademicPersonalInputs> {
  const personalJson = await readJson(args.personalMsiJson);
  const completedJson = await readJson(args.completedCoursesJson);
  const currentJson = await readJson(args.currentCoursesJson);
  const msiGraduationJson = await readJson(args.msiGraduationJson);
  const personalRoot = unwrapRawData(personalJson);
  const completedRoot = unwrapRawData(completedJson);
  const currentRoot = unwrapRawData(currentJson);
  const msiGraduationRoot = unwrapRawData(msiGraduationJson);
  const personalRecord = recordFrom(personalRoot);
  const personalCompletedCandidate =
    personalRecord.completedCourses
    ?? personalRecord.completedCourseTitles
    ?? personalRecord.takenCourses
    ?? personalRecord.gradeHistory
    ?? personalRecord.completed
    ?? (Array.isArray(personalRecord.termRecords) || Array.isArray(personalRecord.courses) ? personalRoot : undefined);
  const personalCurrentCandidate =
    personalRecord.currentCourses
    ?? personalRecord.currentGrades
    ?? personalRecord.currentTimetable
    ?? personalRecord.timetable
    ?? personalRecord.enrolledCourses;
  const personalGraduationCandidate =
    personalRecord.graduation
    ?? personalRecord.msiGraduation
    ?? personalRecord.graduationRoadmap
    ?? personalRecord.graduationAudit;
  const personalGraduation = recordFrom(personalGraduationCandidate);
  const standaloneGraduation = personalRecord.overall || personalRecord.areas || personalRecord.requirements || personalRecord.creditGaps
    ? personalRecord
    : {};
  const explicitGraduation = recordFrom(msiGraduationRoot);
  const studentInfo = firstRecord(
    personalRecord.studentInfo,
    recordFrom(completedRoot).studentInfo,
    recordFrom(currentRoot).studentInfo,
    personalRecord.student,
    recordFrom(completedRoot).student,
    recordFrom(currentRoot).student,
  );
  return {
    completedCourses: dedupeCompletedCourses([
      ...normalizeCompletedCoursesFromMsi(personalCompletedCandidate),
      ...normalizeCompletedCoursesFromMsi(completedRoot),
      ...graduationCompletedCoursesFromCreditGaps(personalGraduation),
      ...graduationCompletedCoursesFromCreditGaps(standaloneGraduation),
      ...graduationCompletedCoursesFromCreditGaps(explicitGraduation),
    ]),
    currentCourses: dedupeCompletedCourses([
      ...normalizeCompletedCoursesFromMsi(personalCurrentCandidate),
      ...normalizeCompletedCoursesFromMsi(currentRoot),
    ]),
    ...(Object.keys(explicitGraduation).length || Object.keys(personalGraduation).length || Object.keys(standaloneGraduation).length
      ? { msiGraduation: { ...standaloneGraduation, ...personalGraduation, ...explicitGraduation } }
      : {}),
    ...(studentInfo ? { studentInfo } : {}),
  };
}

export async function buildAcademicPlanningTimetableResult(args: {
  year: number;
  termCode: string;
  department: string;
  admissionYear: number;
  studentNumberProvided?: boolean;
  studentType?: "domestic" | "foreign";
  expectedGraduationTerm?: string;
  catalogJson?: string;
  requirementsDir?: string;
  personalMsiJson?: string;
  completedCoursesJson?: string;
  currentCoursesJson?: string;
}): Promise<AcademicTimetablePlanningResult> {
  const requirementQuery: AcademicRequirementQuery = {
    department: args.department,
    admissionYear: args.admissionYear,
    ...(args.studentNumberProvided ? { studentNumberProvided: true } : {}),
    ...(args.studentType ? { studentType: args.studentType } : {}),
    ...(args.expectedGraduationTerm ? { expectedGraduationTerm: args.expectedGraduationTerm } : {}),
  };
  const [catalog, requirementSources, personal] = await Promise.all([
    loadCourseCatalogBundle(args),
    loadRequirementSources(requirementQuery, args.requirementsDir),
    loadPersonalInputs(args),
  ]);
  const { items } = catalog;
  const base = buildCourseCatalogListResult(items, {
    year: args.year,
    termCode: args.termCode,
    department: args.department,
  });
  const coverage = officialCoverage(requirementSources, requirementQuery);
  const departmentLabel = departmentDisplayName(args.department, items, requirementSources, personal);
  const standing = studentStandingLabel({
    year: args.year,
    termCode: args.termCode,
    admissionYear: args.admissionYear,
  }, personal);
  const choiceGroups = buildRequirementChoiceGroupsFromSources(requirementSources);
  const selectedChoiceKeys = inferRequirementChoiceSelections(choiceGroups, [
    ...personal.completedCourses,
    ...personal.currentCourses,
  ]);
  const dataReadiness = [
    readinessCheck({
      target: "course-catalog",
      count: items.length,
      scope: { year: args.year, termCode: args.termCode, department: args.department },
    }),
    readinessCheck({
      target: "graduation-requirements",
      count: requirementSources.length,
      scope: { department: args.department, admissionYear: args.admissionYear },
    }),
  ];

  return {
    ...base,
    ...(departmentLabel ? { departmentLabel } : {}),
    ...(standing ? { studentStanding: standing } : {}),
    query: {
      ...(base.query ?? {}),
      ...(departmentLabel ? { departmentLabel, displayDepartment: departmentLabel } : {}),
      ...(standing ? { studentStanding: standing } : {}),
      admissionYear: args.admissionYear,
      ...(args.studentType ? { studentType: args.studentType } : {}),
      ...(args.expectedGraduationTerm ? { expectedGraduationTerm: args.expectedGraduationTerm } : {}),
      ...(args.studentNumberProvided ? { studentNumberProvided: true } : {}),
      ...(coverage.reason ? { unavailableReason: coverage.reason } : {}),
    },
    requirementSources,
    graduationRequirementSources: requirementSources,
    choiceGroups,
    selectedChoiceKeys,
    timetableSelectedChoiceKeys: selectedChoiceKeys,
    completedCourses: personal.completedCourses,
    currentCourses: personal.currentCourses,
    courseCatalogDiagnostics: catalog.diagnostics,
    dataReadiness,
    officialRequirementCoverage: coverage,
    officialCoverage: coverage,
    automaticPlanningApplied: coverage.status === "confirmed",
  };
}

export async function buildAcademicPlanningGraduationRoadmapResult(args: {
  department: string;
  admissionYear: number;
  studentNumberProvided?: boolean;
  studentType?: "domestic" | "foreign";
  expectedGraduationTerm?: string;
  requirementsDir?: string;
  personalMsiJson?: string;
  completedCoursesJson?: string;
  currentCoursesJson?: string;
  msiGraduationJson?: string;
}): Promise<AcademicGraduationRoadmapResult> {
  const requirementQuery: AcademicRequirementQuery = {
    department: args.department,
    admissionYear: args.admissionYear,
    ...(args.studentNumberProvided ? { studentNumberProvided: true } : {}),
    ...(args.studentType ? { studentType: args.studentType } : {}),
    ...(args.expectedGraduationTerm ? { expectedGraduationTerm: args.expectedGraduationTerm } : {}),
  };
  const [requirementSources, personal] = await Promise.all([
    loadRequirementSources(requirementQuery, args.requirementsDir),
    loadPersonalInputs(args),
  ]);
  const coverage = officialCoverage(requirementSources, requirementQuery);
  const requirementResult = buildGraduationRequirementListResult(
    requirementSources,
    {
      ...requirementListQuery(requirementQuery),
      ...(coverage.reason ? { unavailableReason: coverage.reason } : {}),
    },
  );
  const departmentLabel = departmentDisplayName(args.department, [], requirementSources, personal);
  const standing = studentStandingLabel({
    admissionYear: args.admissionYear,
  }, personal);
  const choiceGroups = buildRequirementChoiceGroupsFromSources(requirementSources);
  const selectedChoiceKeys = inferRequirementChoiceSelections(choiceGroups, [
    ...personal.completedCourses,
    ...personal.currentCourses,
  ]);
  const dataReadiness = [
    readinessCheck({
      target: "graduation-requirements",
      count: requirementSources.length,
      scope: { department: args.department, admissionYear: args.admissionYear },
    }),
  ];

  return {
    ...(personal.msiGraduation ?? {}),
    ...(departmentLabel ? { departmentLabel } : {}),
    ...(standing ? { studentStanding: standing } : {}),
    total: requirementSources.length,
    items: requirementSources,
    requirementSources,
    graduationRequirementSources: requirementSources,
    choiceGroups,
    selectedChoiceKeys,
    graduationSelectedChoiceKeys: selectedChoiceKeys,
    completedCourses: personal.completedCourses,
    currentCourses: personal.currentCourses,
    dataReadiness,
    officialRequirementCoverage: coverage,
    officialCoverage: coverage,
    automaticPlanningApplied: coverage.status === "confirmed",
    query: {
      ...(requirementResult.query ?? {}),
      ...(departmentLabel ? { departmentLabel, displayDepartment: departmentLabel } : {}),
      ...(standing ? { studentStanding: standing } : {}),
      ...(coverage.reason ? { unavailableReason: coverage.reason } : {}),
    },
  };
}

function resolveRequirementQuery(opts: {
  department: string;
  admissionYear?: string;
  studentNumber?: string;
  studentType?: string;
  graduationTerm?: string;
}): AcademicRequirementQuery {
  const department = validateDepartment(opts.department);
  const studentNumber = validateStudentNumber(opts.studentNumber);
  const studentType = validateStudentType(opts.studentType);
  const graduationTerm = validateGraduationTerm(opts.graduationTerm);
  return {
    department,
    admissionYear: resolveAdmissionYearForGraduationQuery({
      admissionYear: opts.admissionYear,
      studentNumber,
    }),
    ...(studentNumber ? { studentNumberProvided: true } : {}),
    ...(studentType ? { studentType } : {}),
    ...(graduationTerm ? { expectedGraduationTerm: graduationTerm } : {}),
  };
}

function buildTimetable(): Command {
  return new Command("timetable")
    .description("Compose a reproducible timetable planner payload from catalog and official requirements")
    .requiredOption("--year <year>", "catalog year, for example 2026")
    .requiredOption("--term-code <code>", "term code from worker catalog")
    .requiredOption("--department <department>", "department label or MSI department code")
    .option("--admission-year <year>", "student admission year")
    .option("--student-number <number>", "student number; infers admission year when --admission-year is omitted")
    .option("--student-type <type>", "student type: domestic|foreign")
    .option("--graduation-term <term>", "expected graduation term in YYYY-MM")
    .option("--catalog-json <path>", "locally generated catalog JSON; explicitly bypasses the database")
    .option("--requirements-dir <path>", "graduation requirement JSON directory; bypasses the database")
    .option("--personal-msi-json <path>", "combined local MSI JSON; may include grade history, current courses, and graduation data")
    .option("--completed-courses-json <path>", "MSI grade-history JSON from `mju msi grade-history --format json`")
    .option("--current-courses-json <path>", "MSI current-grades JSON from `mju msi current-grades --format json`")
    .action(async (_args, cmd: Command) => {
      const g = readGlobalOptions(cmd);
      const opts = cmd.opts<{
        year: string;
        termCode: string;
        department: string;
        admissionYear?: string;
        studentNumber?: string;
        studentType?: string;
        graduationTerm?: string;
        catalogJson?: string;
        requirementsDir?: string;
        personalMsiJson?: string;
        completedCoursesJson?: string;
        currentCoursesJson?: string;
      }>();
      const requirementQuery = resolveRequirementQuery(opts);
      const department = validateCatalogDepartment(opts.department) ?? opts.department;
      const result = await buildAcademicPlanningTimetableResult({
        ...requirementQuery,
        year: parseCatalogYear(opts.year),
        termCode: validateTermCode(opts.termCode),
        department,
        catalogJson: resolveCatalogJsonPath(opts.catalogJson),
        ...(opts.requirementsDir ? { requirementsDir: opts.requirementsDir } : {}),
        ...(opts.personalMsiJson ? { personalMsiJson: opts.personalMsiJson } : {}),
        ...(opts.completedCoursesJson ? { completedCoursesJson: opts.completedCoursesJson } : {}),
        ...(opts.currentCoursesJson ? { currentCoursesJson: opts.currentCoursesJson } : {}),
      });
      printData(result, g.format, "academic-planning");
    });
}

function buildGraduationRoadmap(): Command {
  return new Command("graduation-roadmap")
    .description("Compose a reproducible graduation roadmap payload from official requirements and optional MSI exports")
    .requiredOption("--department <department>", "department label or MSI department code")
    .option("--admission-year <year>", "student admission year")
    .option("--student-number <number>", "student number; infers admission year when --admission-year is omitted")
    .option("--student-type <type>", "student type: domestic|foreign")
    .option("--graduation-term <term>", "expected graduation term in YYYY-MM")
    .option("--requirements-dir <path>", "graduation requirement JSON directory; bypasses the database")
    .option("--personal-msi-json <path>", "combined local MSI JSON; may include grade history, current courses, and graduation data")
    .option("--completed-courses-json <path>", "MSI grade-history JSON from `mju msi grade-history --format json`")
    .option("--current-courses-json <path>", "MSI current-grades JSON from `mju msi current-grades --format json`")
    .option("--msi-graduation-json <path>", "MSI graduation JSON from `mju msi graduation --format json`")
    .action(async (_args, cmd: Command) => {
      const g = readGlobalOptions(cmd);
      const opts = cmd.opts<{
        department: string;
        admissionYear?: string;
        studentNumber?: string;
        studentType?: string;
        graduationTerm?: string;
        requirementsDir?: string;
        personalMsiJson?: string;
        completedCoursesJson?: string;
        currentCoursesJson?: string;
        msiGraduationJson?: string;
      }>();
      const result = await buildAcademicPlanningGraduationRoadmapResult({
        ...resolveRequirementQuery(opts),
        ...(opts.requirementsDir ? { requirementsDir: opts.requirementsDir } : {}),
        ...(opts.personalMsiJson ? { personalMsiJson: opts.personalMsiJson } : {}),
        ...(opts.completedCoursesJson ? { completedCoursesJson: opts.completedCoursesJson } : {}),
        ...(opts.currentCoursesJson ? { currentCoursesJson: opts.currentCoursesJson } : {}),
        ...(opts.msiGraduationJson ? { msiGraduationJson: opts.msiGraduationJson } : {}),
      });
      printData(result, g.format, "academic-planning");
    });
}

export function buildAcademicPlanningCommand(): Command {
  const cmd = new Command("academic-planning").description(
    "Reproducible timetable and graduation-roadmap planning payloads",
  );
  cmd.addCommand(buildTimetable());
  cmd.addCommand(buildGraduationRoadmap());
  return cmd;
}
