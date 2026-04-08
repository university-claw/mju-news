import { describe, it, expect } from "vitest";
import { parseFrontmatter } from "../../src/skills/catalog.js";
import { SkillError } from "../../src/errors.js";

describe("parseFrontmatter", () => {
  it("parses flat key-value frontmatter", () => {
    const md = `---
name: getting-mju-news
version: 1.0.0
description: "테스트 설명"
---

# Body`;
    const fm = parseFrontmatter(md);
    expect(fm.name).toBe("getting-mju-news");
    expect(fm.version).toBe("1.0.0");
    expect(fm.description).toBe("테스트 설명");
  });

  it("parses nested metadata.openclaw block", () => {
    const md = `---
name: getting-mju-news
description: "desc"
metadata:
  openclaw:
    category: "service"
    domain: "education"
    requires:
      bins: ["mju-news"]
---

# body`;
    const fm = parseFrontmatter(md);
    expect(fm.metadata?.openclaw?.category).toBe("service");
    expect(fm.metadata?.openclaw?.domain).toBe("education");
    expect(fm.metadata?.openclaw?.requires?.bins).toEqual(["mju-news"]);
  });

  it("throws when frontmatter block missing", () => {
    expect(() => parseFrontmatter("# just a heading")).toThrow(SkillError);
  });
});
