export function normalizeCourseCatalogDepartment(value: string | null | undefined): string | undefined {
  const normalized = value?.replace(/\s+/gu, " ").trim();
  return normalized || undefined;
}

export function courseCatalogDepartmentCandidates(input: string): string[] {
  const normalized = normalizeCourseCatalogDepartment(input);
  if (!normalized) return [];

  const code = normalized.match(/^(\d{5})(?:\s|$)/u)?.[1];
  const withoutCode = normalized.replace(/^\d{5}\s+/u, "").trim();
  const suffix = withoutCode.match(/([^\s]+(?:전공|학과|학부))$/u)?.[1];
  const parent = suffix
    ? withoutCode.slice(0, -suffix.length).trim()
    : "";
  const lastToken = withoutCode.includes(" ") ? withoutCode.split(" ").at(-1) : undefined;

  return [
    normalized,
    code,
    withoutCode,
    parent,
    suffix,
    lastToken,
  ].filter((value): value is string => Boolean(value))
    .filter((value, index, values) => values.indexOf(value) === index);
}

export function courseCatalogSharedLiberalDepartment(department: string | null | undefined): boolean {
  const normalized = normalizeCourseCatalogDepartment(department);
  return Boolean(normalized && /^\d{5}\s.+교양$/u.test(normalized));
}

export function courseCatalogDepartmentMatches(
  department: string | null | undefined,
  queryDepartment: string,
): boolean {
  const normalized = normalizeCourseCatalogDepartment(department);
  if (!normalized) return false;
  if (courseCatalogSharedLiberalDepartment(normalized)) return true;

  return courseCatalogDepartmentCandidates(queryDepartment).some((candidate) => (
    normalized === candidate ||
    normalized.startsWith(`${candidate} `) ||
    candidate.startsWith(`${normalized} `) ||
    normalized.endsWith(` ${candidate}`)
  ));
}
