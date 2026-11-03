/**
 * Build the About page with its English version cleared, the state Pages CMS
 * leaves behind when an editor empties the English group: the CMS deletes a
 * cleared field, so "never written" and "written then cleared" are the same
 * absent value (ADR-0002, "Content model"). GLOSSARY: an Untranslated field
 * shows the Spanish value instead, without a notice.
 *
 * Two fixture pages come out of the real `src/acerca-de.md`, differing only in
 * its English object:
 *
 * - `/acerca-de/` has no `en` object at all;
 * - `/acerca-de-ingles-vacio/` keeps its English title but has a whitespace-only
 *   biography and an empty team, to prove each field falls back on its own.
 *
 * Both stay fully translated in Spanish, so a build that renders them is a
 * build that resolved every field rather than crashed or printed a hole. Only
 * the About page and the files it needs are built, in a throwaway directory, so
 * the fixture costs a few hundred milliseconds; the responsive-image cache in
 * `_site/img` is shared with the default build.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import yaml from "js-yaml";

import { parseFrontMatter } from "../../lib/front-matter.js";

const ROOT = path.resolve(import.meta.dirname, "../..");
const REAL_CONFIG = path.join(ROOT, "eleventy.config.js");
const REAL_ABOUT = path.join(ROOT, "src", "acerca-de.md");

/** The fixture page whose English object is missing entirely. */
export const UNTRANSLATED_ROUTE = "/acerca-de/";

/** The fixture page whose English fields are present but blank. */
export const BLANK_ROUTE = "/acerca-de-ingles-vacio/";

/** A Markdown file whose front matter is the given data. */
const aboutFile = (data) => `---\n${yaml.dump(data, { lineWidth: -1 })}---\n`;

/** The real About front matter, read once, so the fixture cannot drift from it. */
function realAbout() {
  const { data, error } = parseFrontMatter(fs.readFileSync(REAL_ABOUT, "utf8"));
  if (error) throw new Error(`src/acerca-de.md: ${error}`);
  return data;
}

/** A copy of the real page with some keys replaced, renamed onto another route. */
const variant = (about, overrides, permalink) => aboutFile({ ...about, ...overrides, permalink });

let build;

/**
 * Build the two fixture pages and return the output directory.
 *
 * @returns {Promise<string>} a throwaway output directory holding
 *   `/acerca-de/`, `/acerca-de-ingles-vacio/` and their `/en/` counterparts
 */
export function buildUntranslatedAbout() {
  build ??= (async () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lava-untranslated-about-"));
    const inputDir = path.join(fixtureRoot, "src");
    const outputDir = path.join(fixtureRoot, "_site");

    // The layout, the partials and the site settings the About page reads.
    fs.cpSync(path.join(ROOT, "src", "_includes"), path.join(inputDir, "_includes"), { recursive: true });
    fs.cpSync(path.join(ROOT, "src", "_data"), path.join(inputDir, "_data"), { recursive: true });

    const about = realAbout();
    const { en, ...withoutEnglish } = about;
    fs.writeFileSync(path.join(inputDir, "acerca-de.md"), aboutFile(withoutEnglish));
    fs.writeFileSync(
      path.join(inputDir, "acerca-de-ingles-vacio.md"),
      // `en.title` stays as written; the other two fields were cleared.
      variant(about, { en: { title: en?.title, bio: "   ", team: "" } }, "{{ lang.prefix }}/acerca-de-ingles-vacio/"),
    );

    // The real configuration with only the input and output redirected. The
    // passthrough copies are dropped before it runs: this fixture renders pages
    // and writes no assets, and those paths are relative to the repository.
    const configPath = path.join(fixtureRoot, "eleventy.config.mjs");
    fs.writeFileSync(
      configPath,
      [
        `import configure from ${JSON.stringify(REAL_CONFIG)};`,
        "export default function (eleventyConfig) {",
        "  eleventyConfig.addPassthroughCopy = () => {};",
        "  const config = configure(eleventyConfig);",
        "  return {",
        "    ...config,",
        `    dir: { ...config.dir, input: ${JSON.stringify(inputDir)}, output: ${JSON.stringify(outputDir)} },`,
        "  };",
        "}",
        "",
      ].join("\n"),
    );

    const { default: Eleventy } = await import("@11ty/eleventy");
    const elev = new Eleventy(inputDir, outputDir, { configPath });
    elev.setQuietMode?.(true);
    await elev.write();
    return outputDir;
  })();
  return build;
}
