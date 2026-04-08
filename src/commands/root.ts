import { Command } from "commander";
import { APP_DESCRIPTION, APP_NAME, APP_VERSION } from "../app-meta.js";
import { attachGlobalOptions } from "./common.js";
import { buildScrapeCommand } from "./scrape.js";
import { buildListCommand } from "./list.js";
import { buildNewCommand } from "./new.js";
import { buildDoctorCommand } from "./doctor.js";
import { buildSkillsCommand } from "./skills.js";

/**
 * 루트 Command 조립.
 *
 * 각 서브커맨드는 builder 함수로 독립. 이유:
 *  - 테스트에서 서브커맨드 하나만 exercise하기 쉬움
 *  - 순환 의존 방지 (root → children, 아닌 반대)
 */
export function buildRootCommand(): Command {
  const root = new Command(APP_NAME)
    .description(APP_DESCRIPTION)
    .version(APP_VERSION, "-V, --version", "버전 출력")
    .helpOption("-h, --help", "도움말 출력")
    .showHelpAfterError();

  attachGlobalOptions(root);

  root
    .addCommand(buildScrapeCommand())
    .addCommand(buildListCommand())
    .addCommand(buildNewCommand())
    .addCommand(buildDoctorCommand())
    .addCommand(buildSkillsCommand());

  return root;
}
