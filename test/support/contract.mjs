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
 * @param {Record<string, string>} files project content files by name
 * @returns {string} the input directory (`…/src`), registered for cleanup
 */
export function writeContentDir(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lava-contract-"));
  dirs.push(root);
  const inputDir = path.join(root, "src");
  const projectDir = path.join(inputDir, "proyectos");
  fs.mkdirSync(projectDir, { recursive: true });

  fs.copyFileSync(DEFAULTS, path.join(projectDir, path.basename(DEFAULTS)));
  for (const [name, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(projectDir, name), contents);
  }

  for (const folder of ["images", "videos"]) {
    fs.mkdirSync(path.join(inputDir, "assets"), { recursive: true });
    fs.symlinkSync(path.join(REPO_ROOT, "src/assets", folder), path.join(inputDir, "assets", folder));
  }

  return inputDir;
}

/**
 * Build the site from a throwaway input directory with the real configuration,
 * so the build itself is what accepts or rejects the content. Rendering never
 * starts: the contract runs before templates read the content.
 *
 * The fixture gets a two-line config that applies the real configuration and
 * points Eleventy's directories at the throwaway `src/` (the config file's
 * `dir` wins over the constructor arguments).
 *
 * @returns {Promise<string>} the generated output directory
 */
export async function buildContentDir(inputDir) {
  const { default: Eleventy } = await import("@11ty/eleventy");
  const fixtureRoot = path.dirname(inputDir);
  const outputDir = path.join(fixtureRoot, "_site");
  const configPath = path.join(fixtureRoot, "eleventy.config.mjs");

  fs.writeFileSync(
    configPath,
    [
      `import configure from ${JSON.stringify(path.join(REPO_ROOT, "eleventy.config.js"))};`,
      "export default function (eleventyConfig) {",
      "  configure(eleventyConfig);",
      "  return {",
      `    dir: ${JSON.stringify({ input: inputDir, output: outputDir, includes: "_includes", layouts: "_includes/layouts", data: "_data" })},`,
      '    pathPrefix: "/",',
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
