import { Command } from "commander";
import { closePool, getPool, loadDbConfig } from "../db/client.js";
import { readModelStats } from "../db/doctor.js";
import { loadSkillCatalog } from "../skills/catalog.js";
import { printData } from "../output/print.js";
import type { DoctorResult } from "../types.js";
import { readGlobalOptions } from "./common.js";

/**
 * `mju-news doctor` — Reader 건강 체크.
 *
 * 확인 항목:
 *  - DB 연결 가능 여부
 *  - read model 테이블 카운트와 최신 시각
 *  - skills/ 디렉토리 SKILL.md frontmatter 검증
 *
 * 하나라도 실패하면 `ok: false`, exit code 1.
 */
export function buildDoctorCommand(): Command {
  return new Command("doctor")
    .description("DB 연결 + read model + skills 헬스체크")
    .action(async (_options, cmd: Command) => {
      const global = readGlobalOptions(cmd);
      const cfg = loadDbConfig();

      const result: DoctorResult = {
        ok: false,
        node: { version: process.version },
        database: {
          host: cfg.host,
          port: cfg.port,
          database: cfg.database,
          schema: cfg.schema,
          connected: false,
        },
        readModel: {
          noticeItems: 0,
          noticeItemsLatestAt: null,
          cafeteriaMenuEntries: 0,
          cafeteriaMenuEntriesLatestDate: null,
        },
        skills: [],
      };

      const pool = getPool();
      try {
        await pool.query("SELECT 1");
        result.database.connected = true;
        result.readModel = await readModelStats(pool);
      } catch (err) {
        result.database.error =
          err instanceof Error ? err.message : String(err);
      } finally {
        await closePool();
      }

      try {
        const catalog = await loadSkillCatalog();
        for (const entry of catalog) {
          result.skills.push({ name: entry.name, valid: true });
        }
      } catch (err) {
        result.skills.push({
          name: "unknown",
          valid: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      const skillsOk = result.skills.every((s) => s.valid);
      result.ok = result.database.connected && skillsOk;

      printData(result, global.format, "doctor");
      if (!result.ok) process.exit(1);
    });
}
