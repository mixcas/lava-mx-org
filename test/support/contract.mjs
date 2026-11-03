import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { REPO_ROOT } from "./site.mjs";

/** The site's Eleventy input directory: `src/`. */
export const REPO_INPUT = path.join(REPO_ROOT, "src");

/** Directory defaults an editor never writes (see `proyectos.11tydata.json`). */
const DEFAULTS = path.join(REPO_ROOT, "src/proyectos/proyectos.11tydata.json");

/**
 * A project content file: YAML front matter plus an empty body.
 *
 * Callers pass the whole front matter, so a test can write exactly the content
 * it is about (a missing key, a legacy key, a broken media item).
 */
export const projectFile = (frontMatter) => `---\n${frontMatter.trim()}\n---\n`;

const dirs = [];

/**
 * Write a throwaway Eleventy input directory: `src/proyectos/<name>.md` files,
 * the real project directory defaults, and the repository's asset folders
 * (symlinked, so master files resolve without copying every image).
 *
 * `data:` files are written at its `_data/` (the site settings a layout reads,
 * for a fixture that renders).
 *
 * @param {Record<string, string>} files project content files by name
 * @param {{data?: Record<string, string>}} [extra]
 * @returns {string} the input directory (`…/src`), registered for cleanup
 */
export function writeContentDir(files, { data = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lava-contract-"));
  dirs.push(root);
  const inputDir = path.join(root, "src");
  const projectDir = path.join(inputDir, "proyectos");
  fs.mkdirSync(projectDir, { recursive: true });

  fs.copyFileSync(DEFAULTS, path.join(projectDir, path.basename(DEFAULTS)));
  for (const [name, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(projectDir, name), contents);
  }

  for (const [name, contents] of Object.entries(data)) {
    fs.mkdirSync(path.join(inputDir, "_data"), { recursive: true });
    fs.writeFileSync(path.join(inputDir, "_data", name), contents);
  }

  for (const folder of ["images", "videos"]) {
    fs.mkdirSync(path.join(inputDir, "assets"), { recursive: true });
    fs.symlinkSync(path.join(REPO_ROOT, "src/assets", folder), path.join(inputDir, "assets", folder));
  }

  // A fixture that renders needs the real layouts and partials; the contract,
  // which rejects content before anything renders, never reaches them.
  // (By real path: the build runs from `<fixtureRoot>`, where those links
  // would otherwise make Eleventy resolve the repository's own templates from
  // its input directory too.)
  fs.symlinkSync(fs.realpathSync(path.join(REPO_ROOT, "src/_includes")), path.join(inputDir, "_includes"));

  return inputDir;
}

/**
 * Build the site from a throwaway input directory with the real configuration,
 * so the build itself is what accepts or rejects the content. Rendering never
 * starts: the contract runs before templates read the content. Fixtures that do
 * want output ask for `render: true` and supply the site's `_data/` files
 * (the layouts read the settings and the language list).
 *
 * The fixture gets a two-line config that applies the real configuration and
 * points Eleventy's directories at the throwaway `src/` (the config file's
 * `dir` wins over the constructor arguments).
 *
 * The input directory is written relative to the working directory on purpose:
 * with an absolute `dir.input`, Eleventy 3.1.6 skips directory data files
 * (`proyectos.11tydata.json`) and layouts, emitting empty pages.
 *
 * @param {string} inputDir the throwaway `src/` to build
 * @param {{render?: boolean}} [options]
 * @returns {Promise<string>} the generated output directory
 */
export async function buildContentDir(inputDir, { render = false } = {}) {
  const { default: Eleventy } = await import("@11ty/eleventy");
  const fixtureRoot = path.dirname(inputDir);
  const outputDir = path.join(fixtureRoot, "_site");
  const configPath = path.join(fixtureRoot, "eleventy.config.mjs");
  const relativeInput = path.relative(process.cwd(), inputDir);

  fs.writeFileSync(
    configPath,
    [
      `import configure from ${JSON.stringify(path.join(REPO_ROOT, "eleventy.config.js"))};`,
      "export default function (eleventyConfig) {",
      "  configure(eleventyConfig);",
      "  return {",
      `    dir: ${JSON.stringify({ input: relativeInput, output: outputDir, includes: "_includes", layouts: "_includes/layouts", data: "_data" })},`,
      '    pathPrefix: "/",',
      // A contract fixture reads the content and stops there: nothing to build.
      ...(render ? [] : ["    templateFormats: [],"]),
      "  };",
      "}",
      "",
    ].join("\n"),
  );

  const elev = new Eleventy(inputDir, outputDir, { configPath });
  elev.setQuietMode?.(true);
  await elev.write();
  return outputDir;
}

/** Remove every throwaway directory a test created. */
export function removeContentDirs() {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
}
