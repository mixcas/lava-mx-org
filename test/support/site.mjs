import fs from "node:fs";
import path from "node:path";
import { parse } from "node-html-parser";

const ROOT = path.resolve(import.meta.dirname, "../..");

/** Where Eleventy writes the site (same as `npm run build`). */
export const OUTPUT_DIR = path.join(ROOT, "_site");

/** Same defaults as `eleventy.config.js`, so tests follow the deployed layout. */
export const PATH_PREFIX = (process.env.PATH_PREFIX || "/").replace(/\/+$/, "");
export const SITE_URL = (process.env.SITE_URL || "https://lava-mx.org").replace(/\/$/, "");

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

const pages = new Map();

/**
 * Read a generated page as a DOM. Throws a message naming the missing route so
 * a removed or renamed URL fails with a readable error.
 */
export function readPage(route) {
  if (pages.has(route)) return pages.get(route);

  const relative = route.endsWith(".html") ? route : path.join(route, "index.html");
  const file = path.join(OUTPUT_DIR, relative);
  if (!fs.existsSync(file)) {
    throw new Error(`page ${route}: expected generated file ${path.relative(ROOT, file)} (build did not produce this URL)`);
  }

  const doc = parse(fs.readFileSync(file, "utf8"), { comment: false });
  pages.set(route, doc);
  return doc;
}

/** Collapse whitespace so rendered text compares against the content. */
export const normalize = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
