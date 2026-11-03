import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { REPO_ROOT } from "./support/site.mjs";

/**
 * The handoff documentation's structure: the files exist, the README points at
 * them, and the glossary and the ADRs are committed. What they say is the
 * authors' business — pinning prose here would fail on every wording change —
 * except that the retired one-page-per-project shape must not come back as if
 * the site still worked that way.
 */

const DOCS = [
  "docs/editor-guide.md",
  "docs/maintainer-checklist.md",
  "GLOSSARY.md",
  "docs/adr/0001-pages-cms.md",
  "docs/adr/0002-per-language-pages.md",
  "MIGRATION-PLAN.md",
];

/** Documents that describe the site as it is today (unlike the ADRs and the plan). */
const CURRENT_DOCS = ["README.md", "docs/editor-guide.md", "docs/maintainer-checklist.md"];

/** The flat front-matter keys and the split galleries that `es` / `en` replaced. */
const RETIRED_KEYS = ["text_es", "text_en", "bio_es", "bio_en", "media_left", "media_right"];

/** The separator the templates used to draw between the two language versions. */
const RETIRED_DIVIDER = /(?<!:)\/\//;

/** Wording that marks something as no longer part of the site. */
const SAYS_RETIRED = /retir|legacy|reject|rechaz|supersed|gone|ya no| elimin|obsolet/i;

const read = (relative) => fs.readFileSync(path.join(REPO_ROOT, relative), "utf8");

/** Paragraphs and list blocks, the unit a statement is made in. */
const blocks = (text) => text.split(/\n\s*\n/);

describe("documentation", () => {
  it("keeps the handoff documents", () => {
    for (const doc of DOCS) {
      assert.ok(fs.existsSync(path.join(REPO_ROOT, doc)), `${doc}: missing from the repository`);
    }
  });

  it("links every document from the README", () => {
    const readme = read("README.md");
    for (const doc of DOCS) {
      assert.ok(readme.includes(doc), `README.md: does not link ${doc}`);
    }
  });

  it("commits the glossary and the two page-model ADRs", () => {
    for (const doc of ["GLOSSARY.md", "docs/adr/0001-pages-cms.md", "docs/adr/0002-per-language-pages.md"]) {
      assert.doesNotThrow(
        () => execFileSync("git", ["ls-files", "--error-unmatch", doc], { cwd: REPO_ROOT, stdio: "ignore" }),
        `${doc}: not tracked by Git`,
      );
    }
  });

  // ADR-0002 replaced the flat per-language keys with `es` / `en` objects, and
  // the divider went with them. A caption that still teaches the old fields, or
  // promises a `//` between the two languages, sends an editor looking for
  // controls and a separator the site no longer has. Naming them where the
  // document says they were retired or rejected is fine — that is what the
  // build's error message does.
  it("mentions the retired flat language keys and the // divider only as retired", () => {
    for (const doc of CURRENT_DOCS) {
      for (const block of blocks(read(doc))) {
        const mentionsRetired = RETIRED_KEYS.some((key) => block.includes(key)) || RETIRED_DIVIDER.test(block);
        if (!mentionsRetired) continue;
        assert.match(
          block,
          SAYS_RETIRED,
          `${doc}: names a retired key or the "//" divider as if it were current:\n${block.trim().split("\n")[0]}`,
        );
      }
    }
  });

  it("keeps the editor-facing guide free of both, since editors never write them", () => {
    const guide = read("docs/editor-guide.md");
    for (const key of RETIRED_KEYS) {
      assert.ok(!guide.includes(key), `docs/editor-guide.md: names "${key}", which the content model retired`);
    }
    assert.ok(!RETIRED_DIVIDER.test(guide), 'docs/editor-guide.md: mentions a "//" divider');
  });
});
