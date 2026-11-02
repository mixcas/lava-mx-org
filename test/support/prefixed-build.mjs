/**
 * Build the site into a throwaway output directory with the deployment prefix
 * in `PATH_PREFIX`, and print nothing but the build itself.
 *
 * `buildPrefixedSite()` runs this in a child process: `eleventy.config.js`
 * reads `PATH_PREFIX` once, when it is imported, so a second build in the same
 * process cannot use a different prefix. The responsive-image output stays
 * `_site/img` (the shared cache), so the extra build reuses the variants the
 * default build already produced.
 *
 * Usage: `PATH_PREFIX=/repo/ node test/support/prefixed-build.mjs <fixture-root>`
 */

import fs from "node:fs";
import path from "node:path";

import Eleventy from "@11ty/eleventy";

const ROOT = path.resolve(import.meta.dirname, "../..");
const REAL_CONFIG = path.join(ROOT, "eleventy.config.js");

const fixtureRoot = process.argv[2];
if (!fixtureRoot) throw new Error("usage: node test/support/prefixed-build.mjs <fixture-root>");

const inputDir = path.join(ROOT, "src");
const outputDir = path.join(fixtureRoot, "_site");
const configPath = path.join(fixtureRoot, "eleventy.config.mjs");

// The real configuration with only the output redirected. `dir.input` stays
// relative: Eleventy resolves the project directory data file
// (`proyectos.11tydata.json`) against the input path as written, and an
// absolute path silently loses it.
fs.writeFileSync(
  configPath,
  [
    `import configure from ${JSON.stringify(REAL_CONFIG)};`,
    "export default function (eleventyConfig) {",
    "  const config = configure(eleventyConfig);",
    "  return {",
    "    ...config,",
    `    dir: { ...config.dir, output: ${JSON.stringify(outputDir)} },`,
    "  };",
    "}",
    "",
  ].join("\n"),
);

const elev = new Eleventy("src", outputDir, { configPath });
elev.setQuietMode?.(true);
await elev.write();
