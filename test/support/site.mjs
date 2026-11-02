import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { parse } from "node-html-parser";

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(import.meta.dirname, "../..");

/** Repository root, for assertions about committed configuration and content. */
export const REPO_ROOT = ROOT;

/** Read a committed repository file as text. */
export const readRepoFile = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

/** Every file under a repository directory, as repo-relative paths. */
export function listRepoFiles(relative) {
  const dir = path.join(ROOT, relative);
  return fs
    .readdirSync(dir, { recursive: true })
    .filter((entry) => fs.statSync(path.join(dir, entry)).isFile())
    .map((entry) => path.posix.join(relative, ...entry.split(path.sep)));
}

/** Where Eleventy writes the site (same as `npm run build`). */
export const OUTPUT_DIR = path.join(ROOT, "_site");

/** Same defaults as `eleventy.config.js`, so tests follow the deployed layout. */
export const PATH_PREFIX = (process.env.PATH_PREFIX || "/").replace(/\/+$/, "");
export const SITE_URL = (process.env.SITE_URL || "https://lava-mx.org").replace(/\/$/, "");

/** The subpath the default suite also builds, to prove the prefix logic. */
export const SUBPATH_PREFIX = "/lava-mx-org/";

/** Route as the browser sees it, including the deployment path prefix. */
export const localUrl = (route) => `${PATH_PREFIX}${route}`;

let build;

/**
 * Remove the previous build so assertions cannot pass on stale pages, while
 * keeping `_site/img` (the shared responsive-image cache) intact.
 */
function cleanOutput() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const entry of fs.readdirSync(OUTPUT_DIR)) {
    if (entry === "img") continue;
    fs.rmSync(path.join(OUTPUT_DIR, entry), { recursive: true, force: true });
  }
}

/**
 * Build the site once per test run and reuse `_site/` for every assertion.
 * `_site/img` is left alone so @11ty/eleventy-img reuses existing variants.
 */
export function buildSite() {
  build ??= (async () => {
    const started = Date.now();
    const { default: Eleventy } = await import("@11ty/eleventy");
    cleanOutput();
    const elev = new Eleventy(path.join(ROOT, "src"), OUTPUT_DIR, {
      configPath: path.join(ROOT, "eleventy.config.js"),
    });
    elev.setQuietMode?.(true);
    await elev.write();
    const seconds = ((Date.now() - started) / 1000).toFixed(2);
    console.log(`Built ${path.relative(ROOT, OUTPUT_DIR)}/ in ${seconds}s (PATH_PREFIX="${PATH_PREFIX || "/"}", SITE_URL="${SITE_URL}")`);
  })();
  return build;
}

let prefixedBuild;

/**
 * Build the site a second time under `SUBPATH_PREFIX` (ticket #10) and return
 * its output directory. The build runs in a child process (see
 * `support/prefixed-build.mjs`) because the configuration reads the prefix once
 * at import time, and it reuses the responsive-image cache in `_site/img`, so
 * it costs about a second. A run that already builds under the probe prefix
 * (`PATH_PREFIX=/lava-mx-org/`) reuses its own output.
 */
export function buildPrefixedSite() {
  if (PATH_PREFIX === SUBPATH_PREFIX.replace(/\/$/, "")) return OUTPUT_DIR;

  prefixedBuild ??= (async () => {
    const started = Date.now();
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lava-prefix-"));
    await execFileAsync(process.execPath, [path.join(import.meta.dirname, "prefixed-build.mjs"), fixtureRoot], {
      cwd: ROOT,
      env: { ...process.env, PATH_PREFIX: SUBPATH_PREFIX, SITE_URL },
    });
    const seconds = ((Date.now() - started) / 1000).toFixed(2);
    console.log(`Built the ${SUBPATH_PREFIX} variant in ${seconds}s`);
    return path.join(fixtureRoot, "_site");
  })();
  return prefixedBuild;
}

const pages = new Map();

/** Generated file for a route in an output directory, failing with the route. */
function outputFileIn(outputDir, route) {
  const relative = path.extname(route) ? route : path.join(route, "index.html");
  const file = path.join(outputDir, relative);
  if (!fs.existsSync(file)) {
    throw new Error(`page ${route}: expected generated file ${path.relative(ROOT, file)} (build did not produce this URL)`);
  }
  return file;
}

/** Generated file for a route of the default build. */
const outputFile = (route) => outputFileIn(OUTPUT_DIR, route);

/**
 * Read a generated page as a DOM. Throws a message naming the missing route so
 * a removed or renamed URL fails with a readable error.
 */
export function readPage(route) {
  return readOutputPage(OUTPUT_DIR, route);
}

/** Read a page from another build's output directory (e.g. the prefixed build). */
export function readOutputPage(outputDir, route) {
  const key = `${outputDir}\n${route}`;
  if (pages.has(key)) return pages.get(key);

  const doc = parse(fs.readFileSync(outputFileIn(outputDir, route), "utf8"), { comment: false });
  pages.set(key, doc);
  return doc;
}

/** Read a generated non-HTML file (sitemap, robots) as text. */
export function readText(route) {
  return readOutputText(OUTPUT_DIR, route);
}

/** Read a non-HTML file from another build's output directory. */
export function readOutputText(outputDir, route) {
  return fs.readFileSync(outputFileIn(outputDir, route), "utf8");
}

/** Entries generated directly under a route's directory, sorted. */
export function listOutput(route) {
  return fs.readdirSync(path.dirname(outputFile(route))).sort();
}

/** Collapse whitespace so rendered text compares against the content. */
export const normalize = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
