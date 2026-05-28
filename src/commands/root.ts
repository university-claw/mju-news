import { Command } from "commander";
import { APP_DESCRIPTION, APP_NAME, APP_VERSION } from "../app-meta.js";
import { attachGlobalOptions } from "./common.js";
import { buildAcademicPlanningCommand } from "./academic-planning.js";
import { buildNoticesCommand } from "./notices.js";
import { buildCafeteriasCommand } from "./cafeterias.js";
import { buildCourseCatalogCommand } from "./course-catalog.js";
import { buildDoctorCommand } from "./doctor.js";
import { buildGraduationRequirementsCommand } from "./graduation-requirements.js";
import { buildSkillsCommand } from "./skills.js";

export function buildRootCommand(): Command {
  const root = new Command(APP_NAME)
    .description(APP_DESCRIPTION)
    .version(APP_VERSION, "-V, --version", "버전 출력")
    .helpOption("-h, --help", "도움말 출력")
    .showHelpAfterError();

  attachGlobalOptions(root);

  root
    .addCommand(buildNoticesCommand())
    .addCommand(buildCafeteriasCommand())
    .addCommand(buildCourseCatalogCommand())
    .addCommand(buildGraduationRequirementsCommand())
    .addCommand(buildAcademicPlanningCommand())
    .addCommand(buildDoctorCommand())
    .addCommand(buildSkillsCommand());

  return root;
}
