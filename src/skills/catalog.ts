import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SkillError } from "../errors.js";

/**
 * SKILL.md frontmatter (Anthropic Agent Skills 표준 + mju-cli 확장).
 */
export interface SkillFrontmatter {
  name: string;
  version?: string;
  description: string;
  metadata?: {
    openclaw?: {
      category?: string;
      domain?: string;
      requires?: {
        bins?: string[];
        skills?: string[];
      };
    };
  };
}

export interface SkillEntry {
  name: string;
  version?: string;
  description: string;
  path: string;
  frontmatter: SkillFrontmatter;
}

/**
 * skills/ 디렉토리 resolve.
 *
 * 배포 시: `dist/skills/catalog.js` → `../../skills/` (dist 상위의 skills/)
 * 개발 시: `src/skills/catalog.ts` → `../../skills/` (동일)
 *
 * 즉 컴파일된 dist/ 이든 소스에서 실행하든 레포 루트의 skills/를 가리킨다.
 */
export function resolveSkillsDir(): string {
  const here = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(here), "..", "..", "skills");
}

/** skills/ 디렉토리의 모든 SKILL.md 파일을 스캔해 엔트리 반환. */
export async function loadSkillCatalog(): Promise<SkillEntry[]> {
  const skillsDir = resolveSkillsDir();
  let entries: string[];
  try {
    entries = await fs.readdir(skillsDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  const catalog: SkillEntry[] = [];
  for (const entry of entries) {
    const skillDir = path.join(skillsDir, entry);
    const stat = await fs.stat(skillDir).catch(() => null);
    if (!stat?.isDirectory()) continue;

    const skillPath = path.join(skillDir, "SKILL.md");
    const exists = await fs
      .access(skillPath)
      .then(() => true)
      .catch(() => false);
    if (!exists) continue;

    const raw = await fs.readFile(skillPath, "utf-8");
    const frontmatter = parseFrontmatter(raw);
    validateFrontmatter(frontmatter, skillPath);

    catalog.push({
      name: frontmatter.name,
      version: frontmatter.version,
      description: frontmatter.description,
      path: skillPath,
      frontmatter,
    });
  }
  return catalog.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * 아주 얕은 YAML frontmatter 파서.
 *
 * SKILL.md는 frontmatter가 단순해서 (key: value, 중첩은 metadata.openclaw.*)
 * 풀 YAML 파서(js-yaml) 의존성을 피한다. 복잡한 케이스를 만나면 그때 교체.
 */
export function parseFrontmatter(markdown: string): SkillFrontmatter {
  const m = /^---\n([\s\S]*?)\n---/.exec(markdown);
  if (!m || !m[1]) {
    throw new SkillError("SKILL.md missing YAML frontmatter");
  }
  const yaml = m[1];

  // 플랫한 key: value + metadata 블록만 지원
  const lines = yaml.split("\n");
  const result: Record<string, unknown> = {};
  const stack: Array<{ indent: number; obj: Record<string, unknown> }> = [
    { indent: -1, obj: result },
  ];

  for (const rawLine of lines) {
    if (!rawLine.trim() || rawLine.trim().startsWith("#")) continue;
    const indent = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.trim();

    // 현재 indent 이상의 스택은 pop
    while (stack.length > 1 && indent <= stack[stack.length - 1]!.indent) {
      stack.pop();
    }
    const current = stack[stack.length - 1]!.obj;

    const kvMatch = /^([\w.]+)\s*:\s*(.*)$/.exec(line);
    if (!kvMatch) continue;
    const key = kvMatch[1]!;
    let value: string = kvMatch[2] ?? "";

    if (value === "") {
      // 중첩 객체 시작
      const child: Record<string, unknown> = {};
      current[key] = child;
      stack.push({ indent, obj: child });
      continue;
    }

    // inline array: [a, b, c]
    const arrayMatch = /^\[(.*)\]$/.exec(value);
    if (arrayMatch) {
      const items = arrayMatch[1]!
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      current[key] = items;
      continue;
    }

    // 따옴표 제거
    value = value.replace(/^["']|["']$/g, "");
    current[key] = value;
  }

  return result as unknown as SkillFrontmatter;
}

function validateFrontmatter(
  fm: SkillFrontmatter,
  sourcePath: string,
): void {
  if (!fm.name || typeof fm.name !== "string") {
    throw new SkillError(`${sourcePath}: frontmatter.name is required`);
  }
  if (fm.name.length > 64) {
    throw new SkillError(
      `${sourcePath}: frontmatter.name must be <= 64 chars`,
    );
  }
  if (!/^[a-z0-9-]+$/.test(fm.name)) {
    throw new SkillError(
      `${sourcePath}: frontmatter.name must be lowercase alphanumeric + hyphen`,
    );
  }
  if (/(^|-)(anthropic|claude)(-|$)/.test(fm.name)) {
    throw new SkillError(
      `${sourcePath}: frontmatter.name must not contain "anthropic" or "claude"`,
    );
  }
  if (!fm.description || typeof fm.description !== "string") {
    throw new SkillError(`${sourcePath}: frontmatter.description is required`);
  }
  if (fm.description.length > 1024) {
    throw new SkillError(
      `${sourcePath}: frontmatter.description must be <= 1024 chars`,
    );
  }
}
