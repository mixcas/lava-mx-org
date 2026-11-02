import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { REPO_ROOT } from "./support/site.mjs";

/**
 * The handoff documentation's structure: the files exist, the README points at
 * them, and the glossary and the ADR are committed. What they say is the
 * authors' business — pinning prose here would fail on every wording change.
 */

const DOCS = [
  "docs/editor-guide.md",
  "docs/maintainer-checklist.md",
  "GLOSSARY.md",
  "docs/adr/0001-pages-cms.md",
  "MIGRATION-PLAN.md",
];

describe("documentation", () => {
  it("keeps the handoff documents", () => {
    for (const doc of DOCS) {
      assert.ok(fs.existsSync(path.join(REPO_ROOT, doc)), `${doc}: missing from the repository`);
    }
  });

  it("links every document from the README", () => {
    const readme = fs.readFileSync(path.join(REPO_ROOT, "README.md"), "utf8");
    for (const doc of DOCS) {
      assert.ok(readme.includes(doc), `README.md: does not link ${doc}`);
    }
  });

  it("commits the glossary and the Pages CMS ADR", () => {
    for (const doc of ["GLOSSARY.md", "docs/adr/0001-pages-cms.md"]) {
      assert.doesNotThrow(
        () => execFileSync("git", ["ls-files", "--error-unmatch", doc], { cwd: REPO_ROOT, stdio: "ignore" }),
        `${doc}: not tracked by Git`,
      );
    }
  });
});
