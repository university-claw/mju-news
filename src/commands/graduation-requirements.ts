import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { closePool, getPool } from "../db/client.js";
import {
  graduationDepartmentCandidates,
  listGraduationRequirementSources,
} from "../db/graduation-requirements.js";
import { InputError } from "../errors.js";
import { printData } from "../output/print.js";
import type {
  GraduationRequirementCourseGroup,
  GraduationRequirementRule,
  GraduationRequirementSource,
  ListResult,
} from "../types.js";
import { readGlobalOptions } from "./common.js";
import { parseCatalogYear } from "./course-catalog.js";

export { graduationDepartmentCandidates };

export interface GraduationRequirementListQuery {
  department: string;
  admissionYear: number;
  expectedGraduationTerm?: string;
  studentType?: "domestic" | "foreign";
  studentNumberProvided?: boolean;
  unavailableReason?: string;
}

export type GraduationCoverageStatus =
  | "confirmed"
  | "unprovided"
  | "catalog-bucket"
  | "missing";

export type GraduationCoverageCompletionStatus =
  | "complete"
  | "partial"
  | "unprovided"
  | "catalog-bucket"
  | "missing";

export interface GraduationCoverageDepartment {
  code: string;
  label: string;
  status: GraduationCoverageStatus;
  completionStatus: GraduationCoverageCompletionStatus;
  candidates: string[];
  matchedSources: Array<{
    department: string;
    admissionYear: number;
    file?: string;
    statuses: string[];
  }>;
  unprovidedRuleCount: number;
  reason?: string;
}

export interface GraduationCoverageAuditResult {
  total: number;
  summary: Record<GraduationCoverageStatus, number>;
  completionSummary: Record<GraduationCoverageCompletionStatus, number>;
  admissionYear: number;
  departments: GraduationCoverageDepartment[];
}

interface RequirementSeedRuleLike {
  requirementKey?: string | null;
  label?: string | null;
  category?: string | null;
  status?: string | null;
  appliesTo?: Record<string, unknown> | null;
}

interface RequirementSeedSource {
  file?: string;
  department: string;
  admissionYear: number;
  sourceTitle?: string;
  rules: RequirementSeedRuleLike[];
}

export type NormalizedRequirementSeedSource = GraduationRequirementSource & { file?: string };

interface CatalogDepartmentOption {
  code: string;
  label: string;
}

const UNIVERSAL_GRADUATION_REQUIREMENT_DEPARTMENTS = [
  "전체 학부(과)",
  "전체 학부",
  "전체 학과",
  "전체",
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

export function validateDepartment(input: string): string {
  const value = input.trim();
  if (!value || value.length > 80) {
    throw new InputError(`--department must be 1-80 characters (got "${input}")`);
  }
  return value;
}

export function buildGraduationCoverageAudit(args: {
  courseCatalog: unknown;
  requirementSources: RequirementSeedSource[];
  admissionYear: number;
}): GraduationCoverageAuditResult {
  const departments = catalogDepartmentOptions(args.courseCatalog);
  const sourceMap = new Map<string, RequirementSeedSource[]>();
  const departmentScopedSources: RequirementSeedSource[] = [];
  for (const source of args.requirementSources) {
    const key = source.department.replace(/\s+/gu, " ").trim();
    if (!key) continue;
    sourceMap.set(key, [...(sourceMap.get(key) ?? []), source]);
    if (source.rules.some(requirementRuleHasDepartmentScope)) departmentScopedSources.push(source);
  }

  const audited = departments.map((department) => {
    const candidates = graduationDepartmentCandidates(
      department.label,
      args.admissionYear,
    );
    const bucketReason = catalogBucketReason(department, departments, args.admissionYear);
    if (bucketReason) {
      return {
        code: department.code,
        label: department.label,
        status: "catalog-bucket" as const,
        completionStatus: "catalog-bucket" as const,
        candidates,
        matchedSources: [],
        unprovidedRuleCount: 0,
        reason: bucketReason,
      };
    }

    const lookupCandidates = [
      ...candidates,
      ...UNIVERSAL_GRADUATION_REQUIREMENT_DEPARTMENTS,
    ];
    const lookupCandidateSet = new Set(lookupCandidates.map(normalizedDepartmentKey));
    const matchedSources = uniqueBy(
      [
        ...lookupCandidates.flatMap((candidate) => sourceMap.get(normalizedDepartmentKey(candidate)) ?? []),
        ...departmentScopedSources.filter((source) => !lookupCandidateSet.has(normalizedDepartmentKey(source.department))),
      ],
      (source) => `${source.department}\u0000${source.admissionYear}\u0000${source.file ?? source.sourceTitle ?? ""}`,
    )
      .filter((source) => requirementSeedSourceAppliesToAdmissionYear(source, args.admissionYear))
      .map((source) => ({
        ...source,
        rules: source.rules.filter((rule) => requirementSeedRuleAppliesToQuery(rule, {
          admissionYear: args.admissionYear,
          department: department.label,
        })),
      }))
      .filter((source) => source.rules.length > 0);
    const visibleSources = suppressShadowedUnprovidedRules(matchedSources, candidates);
    const visibleUnprovidedRuleCount = visibleSources.reduce(
      (count, source) => count + source.rules.filter((rule) => rule.status === "unprovided").length,
      0,
    );
    const matched = visibleSources.map((source) => ({
      department: source.department,
      admissionYear: source.admissionYear,
      ...(source.file ? { file: source.file } : {}),
      statuses: [...new Set(source.rules.map((rule) => rule.status || "confirmed"))],
    }));
    const hasConfirmed = matched.some((source) => source.statuses.some((status) => status !== "unprovided"));
    const hasUnprovided = matched.some((source) => source.statuses.includes("unprovided"));
    const status: GraduationCoverageStatus = hasConfirmed
      ? "confirmed"
      : hasUnprovided
        ? "unprovided"
        : "missing";
    const completionStatus: GraduationCoverageCompletionStatus = hasConfirmed
      ? hasUnprovided
        ? "partial"
        : "complete"
      : hasUnprovided
        ? "unprovided"
        : "missing";

    return {
      code: department.code,
      label: department.label,
      status,
      completionStatus,
      candidates,
      matchedSources: matched,
      unprovidedRuleCount: visibleUnprovidedRuleCount,
    };
  });

  return {
    total: audited.length,
    admissionYear: args.admissionYear,
    summary: {
      confirmed: audited.filter((item) => item.status === "confirmed").length,
      unprovided: audited.filter((item) => item.status === "unprovided").length,
      "catalog-bucket": audited.filter((item) => item.status === "catalog-bucket").length,
      missing: audited.filter((item) => item.status === "missing").length,
    },
    completionSummary: {
      complete: audited.filter((item) => item.completionStatus === "complete").length,
      partial: audited.filter((item) => item.completionStatus === "partial").length,
      unprovided: audited.filter((item) => item.completionStatus === "unprovided").length,
      "catalog-bucket": audited.filter((item) => item.completionStatus === "catalog-bucket").length,
      missing: audited.filter((item) => item.completionStatus === "missing").length,
    },
    departments: audited,
  };
}

function catalogDepartmentOptions(courseCatalog: unknown): CatalogDepartmentOption[] {
  const snapshots = Array.isArray(courseCatalog) ? courseCatalog : [courseCatalog];
  const byCode = new Map<string, CatalogDepartmentOption>();
  const fallbackByLabel = new Map<string, CatalogDepartmentOption>();
  for (const snapshot of snapshots) {
    const record = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
      ? snapshot as Record<string, unknown>
      : {};
    const metadata = record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
      ? record.metadata as Record<string, unknown>
      : {};
    const options = Array.isArray(metadata.departmentOptions)
      ? metadata.departmentOptions
      : [];
    for (const option of options) {
      const optionRecord = option && typeof option === "object" && !Array.isArray(option)
        ? option as Record<string, unknown>
        : {};
      const code = stringValue(optionRecord.code);
      const label = stringValue(optionRecord.label);
      if (code && label) byCode.set(code, { code, label });
    }

    const entries = Array.isArray(record.entries) ? record.entries : [];
    for (const entry of entries) {
      const entryRecord = entry && typeof entry === "object" && !Array.isArray(entry)
        ? entry as Record<string, unknown>
        : {};
      const label = stringValue(entryRecord.department);
      if (!label) continue;
      const code = label.match(/^(\d{5})\s/u)?.[1] ?? label;
      fallbackByLabel.set(label, { code, label });
    }
  }

  const values = byCode.size > 0 ? [...byCode.values()] : [...fallbackByLabel.values()];
  return values.sort((a, b) => a.code.localeCompare(b.code, "en"));
}

function catalogBucketReason(
  department: CatalogDepartmentOption,
  departments: CatalogDepartmentOption[],
  admissionYear: number,
): string | undefined {
  const label = department.label.replace(/^\d+\s+/u, "").trim();
  if (NON_UNDERGRADUATE_CATALOG_DEPARTMENT_CODES.has(department.code)) return "non-undergraduate catalog bucket";
  const admissionYearFrom = CATALOG_DEPARTMENT_ADMISSION_YEAR_FROM_BY_CODE.get(department.code);
  if (admissionYearFrom != null && admissionYear < admissionYearFrom) return "not offered for admission year";
  if (/교양$/u.test(label)) return "liberal catalog bucket";
  if (/대학$/u.test(label)) return "college catalog bucket";
  if (label === "융합전공") return "convergence-major catalog bucket";
  if (/학부$/u.test(label) && hasChildDepartmentOption(department, departments)) {
    return "department group catalog bucket";
  }
  return undefined;
}

function hasChildDepartmentOption(
  department: CatalogDepartmentOption,
  departments: CatalogDepartmentOption[],
): boolean {
  if (!/0$/u.test(department.code) || department.code.length < 5) return false;
  const prefix = department.code.slice(0, 4);
  return departments.some((candidate) => (
    candidate.code !== department.code &&
    candidate.code.startsWith(prefix) &&
    !/0$/u.test(candidate.code)
  ));
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

function requirementSeedSourceAppliesToAdmissionYear(
  source: Pick<RequirementSeedSource, "department" | "sourceTitle" | "admissionYear">,
  admissionYear: number,
): boolean {
  const range = cohortRangeFromText([
    source.department,
    source.sourceTitle,
  ].filter(Boolean).join(" "));
  if (range) return cohortRangeApplies(range, admissionYear);
  return source.admissionYear <= admissionYear;
}

function requirementSeedRuleAppliesToAdmissionYear(
  rule: RequirementSeedRuleLike,
  admissionYear: number,
): boolean {
  return requirementSeedAppliesToQuery(rule.appliesTo ?? {}, { admissionYear });
}

function requirementSeedRuleAppliesToQuery(
  rule: Pick<RequirementSeedRuleLike, "appliesTo">,
  query: GraduationRequirementListQuery,
): boolean {
  return requirementSeedAppliesToQuery(rule.appliesTo ?? {}, query);
}

function requirementSeedCourseGroupAppliesToQuery(
  group: GraduationRequirementCourseGroup,
  query: GraduationRequirementListQuery,
): boolean {
  return requirementSeedAppliesToQuery(group.appliesTo ?? {}, query);
}

function requirementSeedAppliesToQuery(
  appliesTo: Record<string, unknown>,
  query: {
    department?: string;
    admissionYear: number;
    expectedGraduationTerm?: string;
    studentType?: "domestic" | "foreign";
  },
): boolean {
  const from = numberValue(appliesTo.admissionYearFrom ?? appliesTo.admission_year_from);
  if (from != null && query.admissionYear < from) return false;
  const to = numberValue(appliesTo.admissionYearTo ?? appliesTo.admission_year_to);
  if (to != null && query.admissionYear > to) return false;

  const studentType = validateStudentType(stringValue(appliesTo.studentType ?? appliesTo.student_type));
  if (studentType && studentType !== (query.studentType ?? "domestic")) return false;
  if (!requirementSeedDepartmentApplies(appliesTo, query.department)) return false;

  const expectedRank = graduationTermRank(query.expectedGraduationTerm);
  if (expectedRank == null) return true;
  const termFromRank = graduationTermRank(stringValue(appliesTo.graduationTermFrom ?? appliesTo.graduation_term_from));
  if (termFromRank != null && expectedRank < termFromRank) return false;
  const termToRank = graduationTermRank(stringValue(appliesTo.graduationTermTo ?? appliesTo.graduation_term_to));
  if (termToRank != null && expectedRank > termToRank) return false;
  return true;
}

function requirementSeedDepartmentApplies(appliesTo: Record<string, unknown>, department: string | undefined): boolean {
  const normalized = (department ?? "").replace(/\s+/gu, " ").trim();
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

function cohortRangeFromText(value: string): { from?: number; to?: number } | null {
  const range = value.match(/\b((?:19|20)\d{2})\s*[-~\u2013\u2014]\s*((?:19|20)\d{2})\b/u);
  if (range) return { from: Number(range[1]), to: Number(range[2]) };

  const openEnded = value.match(/\b((?:19|20)\d{2})\s*\+/u);
  return openEnded ? { from: Number(openEnded[1]) } : null;
}

function cohortRangeApplies(range: { from?: number; to?: number }, admissionYear: number): boolean {
  if (range.from != null && admissionYear < range.from) return false;
  if (range.to != null && admissionYear > range.to) return false;
  return true;
}

function graduationTermRank(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/^((?:19|20)\d{2})-(0[1-9]|1[0-2])$/);
  return match ? Number(match[1]) * 100 + Number(match[2]) : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(stringValue).filter(Boolean)
    : [];
}

function normalizedDepartmentKey(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function uniqueBy<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const item of items) {
    const key = keyOf(item);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function suppressShadowedUnprovidedRules<
  TSource extends { department: string; rules: RequirementSeedRuleLike[] },
>(
  sources: TSource[],
  departmentCandidates: string[],
): TSource[] {
  const confirmedPriorityByRule = new Map<string, number>();
  const unprovidedPriorityByRule = new Map<string, number>();

  for (const source of sources) {
    for (const rule of source.rules) {
      const priority = requirementRulePriority(source.department, rule, departmentCandidates);
      const key = requirementRuleShadowKey(rule);
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
          const priority = requirementRulePriority(source.department, rule, departmentCandidates);
          if (rule.status !== "unprovided") return true;
          const key = requirementRuleShadowKey(rule);
          const confirmedPriority = confirmedPriorityByRule.get(key);
          if (confirmedPriority != null && confirmedPriority <= priority) return false;
          return unprovidedPriorityByRule.get(key) === priority;
        }),
      };
    })
    .filter((source) => source.rules.length > 0) as TSource[];
}

function requirementRulePriority(
  department: string,
  rule: RequirementSeedRuleLike,
  departmentCandidates: string[],
): number {
  const priority = requirementSourcePriority(department, departmentCandidates);
  return priority >= 100_000 && requirementRuleHasDepartmentScope(rule) ? 0 : priority;
}

function requirementRuleHasDepartmentScope(rule: RequirementSeedRuleLike): boolean {
  const appliesTo = rule.appliesTo ?? {};
  return stringArray(appliesTo.departmentPatterns ?? appliesTo.department_patterns).length > 0 ||
    stringArray(appliesTo.departmentExcludes ?? appliesTo.department_excludes).length > 0;
}

function requirementRuleShadowKey(rule: RequirementSeedRuleLike): string {
  return [normalizedRequirementShadowToken(rule.category), normalizedRequirementShadowToken(rule.label)]
    .filter(Boolean)
    .join("\u0000") ||
    stringValue(rule.requirementKey);
}

function normalizedRequirementShadowToken(value: unknown): string {
  const normalized = stringValue(value).replace(/\s+/gu, "").trim();
  if (normalized === "전공필수과목") return "전공필수";
  return normalized;
}

function requirementSourcePriority(department: string, departmentCandidates: string[]): number {
  const normalized = department.replace(/\s+/gu, " ").trim();
  const candidateIndex = departmentCandidates
    .map((candidate) => candidate.replace(/\s+/gu, " ").trim())
    .indexOf(normalized);
  if (candidateIndex >= 0) return candidateIndex;
  if (UNIVERSAL_GRADUATION_REQUIREMENT_DEPARTMENTS.includes(normalized)) return 1_000_000;
  return 100_000;
}

function requirementSeedRule(value: unknown, index: number): GraduationRequirementRule | undefined {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const label = stringValue(record.label);
  const category = stringValue(record.category) || label;
  const requirementKey = stringValue(record.requirementKey ?? record.requirement_key ?? record.key) ||
    [category, label, index + 1].filter(Boolean).join("-");
  if (!label && !category) return undefined;
  return {
    requirementKey,
    label: label || category,
    category,
    requiredCredits: numberValue(record.requiredCredits ?? record.required_credits) ?? null,
    requiredCourseCodes: stringArray(record.requiredCourseCodes ?? record.required_course_codes),
    requiredCourseTitles: stringArray(record.requiredCourseTitles ?? record.required_course_titles),
    courseGroups: requirementSeedCourseGroups(record.courseGroups ?? record.course_groups),
    programTrack: stringValue(record.programTrack ?? record.program_track) || null,
    minCourses: numberValue(record.minCourses ?? record.min_courses) ?? null,
    appliesTo: requirementSeedAppliesTo(record.appliesTo ?? record.applies_to),
    status: record.status === "unprovided" || record.ruleStatus === "unprovided" || record.rule_status === "unprovided"
      ? "unprovided"
      : "confirmed",
    note: stringValue(record.note) || null,
  };
}

function requirementSeedCourseGroups(value: unknown): GraduationRequirementCourseGroup[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = item && typeof item === "object" && !Array.isArray(item)
      ? item as Record<string, unknown>
      : {};
    return {
      groupKey: stringValue(record.groupKey ?? record.group_key) || null,
      label: stringValue(record.label),
      requiredCredits: numberValue(record.requiredCredits ?? record.required_credits) ?? null,
      minCourses: numberValue(record.minCourses ?? record.min_courses) ?? null,
      requiredCourseCodes: stringArray(record.requiredCourseCodes ?? record.required_course_codes),
      requiredCourseTitles: stringArray(record.requiredCourseTitles ?? record.required_course_titles),
      groupType: stringValue(record.groupType ?? record.group_type) || null,
      alternativeGroup: stringValue(record.alternativeGroup ?? record.alternative_group) || null,
      appliesTo: requirementSeedAppliesTo(record.appliesTo ?? record.applies_to),
      note: stringValue(record.note) || null,
    };
  });
}

function requirementSeedAppliesTo(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function requirementSeedForQuery(
  source: NormalizedRequirementSeedSource,
  query: GraduationRequirementListQuery,
): NormalizedRequirementSeedSource | undefined {
  if (!requirementSeedSourceAppliesToAdmissionYear(source, query.admissionYear)) return undefined;
  const rules = source.rules
    .filter((rule) => requirementSeedRuleAppliesToQuery(rule, query))
    .map((rule) => ({
      ...rule,
      courseGroups: rule.courseGroups.filter((group) => requirementSeedCourseGroupAppliesToQuery(group, query)),
    }))
    .filter((rule) => rule.courseGroups.length > 0 || requirementSeedRuleHasDirectPayload(rule));
  return rules.length ? { ...source, rules } : undefined;
}

function requirementSeedRuleHasDirectPayload(rule: GraduationRequirementRule): boolean {
  return rule.requiredCredits != null ||
    rule.requiredCourseCodes.length > 0 ||
    rule.requiredCourseTitles.length > 0 ||
    rule.status === "unprovided";
}

export function listGraduationRequirementSourcesFromSeeds(
  sources: NormalizedRequirementSeedSource[],
  query: GraduationRequirementListQuery,
): GraduationRequirementSource[] {
  if (isCatalogExcludedGraduationDepartmentQuery(query.department, query.admissionYear)) return [];

  const departmentCandidates = graduationDepartmentCandidates(query.department, query.admissionYear);
  const lookupDepartments = new Set([
    ...departmentCandidates,
    ...UNIVERSAL_GRADUATION_REQUIREMENT_DEPARTMENTS,
  ].map(normalizedDepartmentKey));

  const applicable = sources
    .filter((source) => lookupDepartments.has(normalizedDepartmentKey(source.department)) ||
      source.rules.some(requirementRuleHasDepartmentScope))
    .map((source) => requirementSeedForQuery(source, query))
    .filter((source): source is NormalizedRequirementSeedSource => Boolean(source))
    .sort((a, b) => {
      const aDirect = departmentCandidates.includes(a.department) ? 0 : 1;
      const bDirect = departmentCandidates.includes(b.department) ? 0 : 1;
      return aDirect - bDirect || b.admissionYear - a.admissionYear || a.department.localeCompare(b.department, "ko");
    });

  return suppressShadowedUnprovidedRules(applicable, departmentCandidates);
}

async function readJson(pathname: string): Promise<unknown> {
  return JSON.parse(await readFile(pathname, "utf8"));
}

export async function readRequirementSeeds(inputDir: string): Promise<NormalizedRequirementSeedSource[]> {
  const entries = await readdir(inputDir, { withFileTypes: true });
  const sources: NormalizedRequirementSeedSource[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const file = path.join(inputDir, entry.name);
    const parsed = await readJson(file);
    const record = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
    const department = stringValue(record.department);
    const admissionYear = Number(record.admissionYear);
    const sourceTitle = stringValue(record.sourceTitle ?? record.source_title);
    const sourceUrl = stringValue(record.sourceUrl ?? record.source_url);
    if (!department || !Number.isInteger(admissionYear)) continue;
    const rules = Array.isArray(record.rules)
      ? record.rules.map(requirementSeedRule).filter((rule): rule is GraduationRequirementRule => Boolean(rule))
      : [];
    sources.push({
      id: sources.length + 1,
      file: entry.name,
      department,
      admissionYear,
      sourceKind: stringValue(record.sourceKind ?? record.source_kind) || "seed_json",
      sourceTitle: sourceTitle || entry.name,
      sourceUrl: sourceUrl || "",
      sourcePublishedAt: stringValue(record.sourcePublishedAt ?? record.source_published_at) || null,
      sourceRetrievedAt: stringValue(record.sourceRetrievedAt ?? record.source_retrieved_at) || "",
      rules,
    });
  }
  return sources;
}

export function validateGraduationTerm(input: string | undefined): string | undefined {
  if (input == null || input === "") return undefined;
  const value = input.trim();
  if (!/^((?:19|20)\d{2})-(0[1-9]|1[0-2])$/.test(value)) {
    throw new InputError(`--graduation-term must be YYYY-MM (got "${input}")`);
  }
  return value;
}

export function validateStudentNumber(input: string | undefined): string | undefined {
  if (input == null || input === "") return undefined;
  const value = input.trim();
  if (!value || value.length > 32 || !/\d/.test(value)) {
    throw new InputError(`--student-number must contain a student number (got "${input}")`);
  }
  return value;
}

export function validateStudentType(input: string | undefined): "domestic" | "foreign" | undefined {
  if (input == null || input === "") return undefined;
  const value = input.trim().toLowerCase();
  if (!value) return undefined;
  if (["domestic", "local", "korean", "내국인", "국내"].includes(value)) return "domestic";
  if (["foreign", "international", "foreigner", "외국인", "유학생"].includes(value)) return "foreign";
  throw new InputError(`--student-type must be domestic or foreign (got "${input}")`);
}

export function inferAdmissionYearFromStudentNumber(input: string | undefined): number | undefined {
  const value = validateStudentNumber(input);
  if (!value) return undefined;
  const digits = value.replace(/\D/g, "");
  const fourDigitYear = Number(digits.slice(0, 4));
  if (Number.isInteger(fourDigitYear) && fourDigitYear >= 2000 && fourDigitYear <= 2100) {
    return fourDigitYear;
  }

  const mjuStyle = digits.match(/^\d{2}([0-3]\d)\d{4,}$/);
  if (!mjuStyle) return undefined;
  const inferred = 2000 + Number(mjuStyle[1]);
  return inferred >= 2000 && inferred <= 2040 ? inferred : undefined;
}

export function resolveAdmissionYearForGraduationQuery(args: {
  admissionYear?: string;
  studentNumber?: string;
}): number {
  const explicitYear = args.admissionYear ? parseCatalogYear(args.admissionYear) : undefined;
  const inferredYear = inferAdmissionYearFromStudentNumber(args.studentNumber);

  if (explicitYear != null && inferredYear != null && explicitYear !== inferredYear) {
    throw new InputError(
      `--admission-year ${explicitYear} does not match --student-number admission year ${inferredYear}`,
    );
  }
  if (explicitYear != null) return explicitYear;
  if (inferredYear != null) return inferredYear;
  throw new InputError("--admission-year is required unless --student-number can infer the admission year");
}

export function buildGraduationRequirementListResult(
  items: GraduationRequirementSource[],
  query: GraduationRequirementListQuery,
): ListResult<GraduationRequirementSource> {
  const unavailableReason = items.length === 0
    ? query.unavailableReason ?? graduationRequirementUnavailableReason(query.department, query.admissionYear)
    : undefined;

  return {
    total: items.length,
    items,
    query: {
      department: query.department,
      admissionYear: query.admissionYear,
      ...(query.expectedGraduationTerm
        ? { expectedGraduationTerm: query.expectedGraduationTerm }
        : {}),
      ...(query.studentType ? { studentType: query.studentType } : {}),
      ...(query.studentNumberProvided ? { studentNumberProvided: true } : {}),
      ...(unavailableReason ? { unavailableReason } : {}),
    },
  };
}

export function graduationRequirementUnavailableReason(department: string, admissionYear?: number): string {
  const label = department.replace(/^\d+\s+/u, "").trim();
  const cohort = admissionYear ? `${admissionYear}학번 기준 ` : "";
  if (/교양$/u.test(label)) {
    return "교양 분류 코드는 졸업요건 조회 대상 학과/전공이 아닙니다. 학생 소속 학과/전공을 선택해야 합니다.";
  }
  if (/대학$/u.test(label)) {
    return "단과대학 단위는 전공별 졸업요건이 달라 학과/전공을 선택해야 합니다.";
  }
  if (label === "융합전공") {
    return "융합전공 전체 단위는 세부 융합전공별 졸업요건이 달라 개별 전공을 선택해야 합니다.";
  }
  if (/학부$/u.test(label)) {
    return "학부 단위는 세부 전공별 졸업요건이 다를 수 있어 공식 전공 기준 데이터가 필요합니다.";
  }
  if (/학부/u.test(label) && /전공/u.test(label)) {
    return `${cohort}선택한 학부 내 전공의 공식 졸업요건 데이터가 아직 등록되지 않았습니다.`;
  }
  return `${cohort}선택한 학과/전공 조합의 공식 졸업요건 데이터가 아직 등록되지 않았습니다.`;
}

function buildList(): Command {
  return new Command("list")
    .description("Official-source-backed graduation requirement rules")
    .requiredOption("--department <department>", "department name, for example 컴퓨터공학전공")
    .option("--admission-year <year>", "student admission year")
    .option("--student-number <number>", "student number; infers admission year when --admission-year is omitted")
    .option("--student-type <type>", "student type: domestic|foreign")
    .option("--graduation-term <term>", "expected graduation term in YYYY-MM, for example 2027-08")
    .option("--requirements-dir <path>", "graduation requirement JSON directory; bypasses the database for local smoke views")
    .action(async (_args, cmd: Command) => {
      const g = readGlobalOptions(cmd);
      const opts = cmd.opts<{
        department: string;
        admissionYear?: string;
        studentNumber?: string;
        studentType?: string;
        graduationTerm?: string;
        requirementsDir?: string;
      }>();
      const department = validateDepartment(opts.department);
      const studentNumber = validateStudentNumber(opts.studentNumber);
      const admissionYear = resolveAdmissionYearForGraduationQuery({
        admissionYear: opts.admissionYear,
        studentNumber,
      });
      const expectedGraduationTerm = validateGraduationTerm(opts.graduationTerm);
      const studentType = validateStudentType(opts.studentType);
      const query = {
        department,
        admissionYear,
        ...(expectedGraduationTerm ? { expectedGraduationTerm } : {}),
        ...(studentType ? { studentType } : {}),
        ...(studentNumber ? { studentNumberProvided: true } : {}),
      };

      if (opts.requirementsDir) {
        const items = listGraduationRequirementSourcesFromSeeds(await readRequirementSeeds(opts.requirementsDir), query);
        printData(buildGraduationRequirementListResult(items, query), g.format, "graduation-requirements");
        return;
      }

      const pool = getPool();
      try {
        const items = await listGraduationRequirementSources(pool, {
          department,
          admissionYear,
          ...(expectedGraduationTerm ? { expectedGraduationTerm } : {}),
          ...(studentType ? { studentType } : {}),
        });
        const result = buildGraduationRequirementListResult(items, query);
        printData(result, g.format, "graduation-requirements");
      } finally {
        await closePool();
      }
    });
}

function buildAuditCoverage(): Command {
  return new Command("audit-coverage")
    .description("Audit graduation requirement JSON coverage against an MSI course catalog export")
    .requiredOption("--catalog-json <path>", "locally generated course catalog JSON")
    .requiredOption("--requirements-dir <path>", "graduation requirement JSON directory")
    .option("--admission-year <year>", "student admission year to audit", "2025")
    .option("--student-number <number>", "student number; verifies or infers admission year for the audit")
    .action(async (_args, cmd: Command) => {
      const g = readGlobalOptions(cmd);
      const opts = cmd.opts<{
        catalogJson: string;
        requirementsDir: string;
        admissionYear?: string;
        studentNumber?: string;
      }>();
      const studentNumber = validateStudentNumber(opts.studentNumber);
      const admissionYear = resolveAdmissionYearForGraduationQuery({
        admissionYear: opts.admissionYear,
        studentNumber,
      });
      const result = buildGraduationCoverageAudit({
        courseCatalog: await readJson(opts.catalogJson),
        requirementSources: await readRequirementSeeds(opts.requirementsDir),
        admissionYear,
      });
      printData(result, g.format, "graduation-requirements");
    });
}

export function buildGraduationRequirementsCommand(): Command {
  const cmd = new Command("graduation-requirements").description(
    "Official graduation requirement source/rule read model",
  );
  cmd.addCommand(buildList());
  cmd.addCommand(buildAuditCoverage());
  return cmd;
}
