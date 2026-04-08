import { Command } from "commander";
import { loadSkillCatalog } from "../skills/catalog.js";
import { printData } from "../output/print.js";
import { InputError } from "../errors.js";
import { readGlobalOptions } from "./common.js";

/**
 * `mju-news skills list` / `skills show --name <n>`.
 *
 * Agent runtime이 어떤 skill이 설치되어 있는지 inspect 하거나,
 * 운영자가 frontmatter 이상을 확인할 때 사용.
 */
export function buildSkillsCommand(): Command {
  const cmd = new Command("skills").description(
    "등록된 Agent Skill 조회 (skills/ 디렉토리)",
  );

  cmd
    .command("list")
    .description("모든 SKILL.md 나열")
    .action(async (_options, thisCmd: Command) => {
      const global = readGlobalOptions(thisCmd);
      const catalog = await loadSkillCatalog();
      const summary = catalog.map((s) => ({
        name: s.name,
        version: s.version,
        description: s.description,
        path: s.path,
      }));
      printData(summary, global.format, "skills");
    });

  cmd
    .command("show")
    .description("특정 SKILL.md 상세")
    .requiredOption("--name <name>", "skill 이름 (frontmatter.name)")
    .action(async (_options, thisCmd: Command) => {
      const global = readGlobalOptions(thisCmd);
      const opts = thisCmd.opts<{ name: string }>();
      const catalog = await loadSkillCatalog();
      const entry = catalog.find((s) => s.name === opts.name);
      if (!entry) {
        throw new InputError(`skill not found: ${opts.name}`);
      }
      printData(entry, global.format, "skills");
    });

  return cmd;
}
