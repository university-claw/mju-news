import fs from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { resolveDataDir } from "../storage/paths.js";
import { SCRAPERS } from "../scrapers/index.js";
import { httpCheck } from "../http/client.js";
import { loadSkillCatalog } from "../skills/catalog.js";
import { printData } from "../output/print.js";
import type { DoctorResult } from "../types.js";
import { readGlobalOptions } from "./common.js";

/**
 * `mju-news doctor` — 환경/설정 건강 체크.
 *
 * 실행 항목:
 *  - Node 버전 (>=22)
 *  - data 디렉토리 쓰기 권한
 *  - 각 스크래퍼 URL reachability (GET, 5s timeout)
 *  - skills/ 디렉토리 SKILL.md frontmatter 검증
 *
 * 하나라도 실패하면 `ok: false`, exit code 1.
 */
export function buildDoctorCommand(): Command {
  const cmd = new Command("doctor")
    .description("환경/설정 헬스체크 (Node, 저장소, 소스 URL, skills)")
    .action(async (_options, thisCmd: Command) => {
      const global = readGlobalOptions(thisCmd);

      // Node
      const nodeVersion = process.version;
      const nodeMajor = Number(nodeVersion.slice(1).split(".")[0]);
      const nodeOk = Number.isFinite(nodeMajor) && nodeMajor >= 22;

      // data dir
      const dataDirPath = resolveDataDir(global.dataDir || undefined);
      const writable = await checkWritable(dataDirPath);

      // sources
      const sources: DoctorResult["sources"] = {};
      await Promise.all(
        Object.values(SCRAPERS).map(async (s) => {
          const check = await httpCheck(s.config.baseUrl);
          const entry: DoctorResult["sources"][string] = {
            url: s.config.baseUrl,
            reachable: check.reachable,
          };
          if (check.error) entry.error = check.error;
          sources[s.config.id] = entry;
        }),
      );

      // skills
      const skills: DoctorResult["skills"] = [];
      try {
        const catalog = await loadSkillCatalog();
        for (const entry of catalog) {
          skills.push({ name: entry.name, valid: true });
        }
      } catch (err) {
        skills.push({
          name: "unknown",
          valid: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      const sourcesOk = Object.values(sources).every((s) => s.reachable);
      const skillsOk = skills.every((s) => s.valid);
      const ok = nodeOk && writable && sourcesOk && skillsOk;

      const result: DoctorResult = {
        node: { version: nodeVersion, ok: nodeOk },
        dataDir: { path: dataDirPath, writable },
        sources,
        skills,
        ok,
      };
      printData(result, global.format, "doctor");
      if (!ok) process.exit(1);
    });
  return cmd;
}

async function checkWritable(dir: string): Promise<boolean> {
  try {
    await fs.mkdir(dir, { recursive: true });
    const probe = path.join(dir, ".mju-news-write-test");
    await fs.writeFile(probe, "");
    await fs.unlink(probe);
    return true;
  } catch {
    return false;
  }
}
