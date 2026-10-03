#!/usr/bin/env node
/**
 * Phase 0 — Cargo backup
 * ----------------------
 * Mirrors every page listed in the live Cargo sitemap into `_cargo-export/`:
 *
 *   pages/<slug>.html   raw HTML of the page
 *   state/<slug>.json   parsed window.__PRELOADED_STATE__ (asset metadata etc.)
 *   site/sitemap.xml    original sitemap
 *   site/robots.txt     original robots.txt
 *   manifest.json       index of everything captured (url, status, title, files)
 *
 * Safe to re-run. The output directory is git-ignored; it is our safety net and
 * the source for the Phase 1 extraction script.
 *
 * Usage:
 *   node scripts/backup.mjs
 *   CARGO_SITE_URL=https://lava-mx.org node scripts/backup.mjs
 *
 * Note: this environment blocks Node's built-in sockets, so network requests
 * are delegated to the system `curl` binary.
 */
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const CURL_META = "\n__CURL_META__";

const SITE = (process.env.CARGO_SITE_URL || "https://lava-mx.org").replace(/\/$/, "");
const ROOT = path.resolve("_cargo-export");
const CONCURRENCY = 4;

/** Turn a URL pathname into a filesystem-safe slug. */
function slugFor(pathname) {
  const decoded = decodeURIComponent(pathname || "/");
  if (decoded === "/" || decoded === "") return "home";
  return decoded
    .replace(/^\/+|\/+$/g, "")
    .replace(/\//g, "__")
    .replace(/[^a-zA-Z0-9._-]+/g, "-");
}

/**
 * Fetch a URL as text using `curl` (Node sockets are blocked in this sandbox).
 * Returns the body plus the HTTP status reported via a trailing marker.
 */
async function fetchText(url) {
  let stdout;
  try {
    ({ stdout } = await execFileAsync(
      "curl",
      [
        "-fsSL",
        "--max-time",
        "60",
        "-A",
        "lava-mx-migration/1.0 (Phase 0 backup)",
        "-w",
        `${CURL_META}%{http_code}`,
        url,
      ],
      { maxBuffer: 64 * 1024 * 1024, encoding: "utf8" },
    ));
  } catch (err) {
    const detail = (err.stderr || err.message || "").trim();
    throw new Error(detail || `curl failed for ${url}`);
  }

  const markerAt = stdout.lastIndexOf(CURL_META);
  const body = markerAt === -1 ? stdout : stdout.slice(0, markerAt);
  const status = markerAt === -1 ? 200 : Number(stdout.slice(markerAt + CURL_META.length)) || 200;
  return { body, finalUrl: url, status };
}

/**
 * Extract `window.__PRELOADED_STATE__ = { ... }` from a Cargo page using
 * string-aware brace matching (robust to `}` inside string values).
 */
function extractPreloadedState(html) {
  const marker = "window.__PRELOADED_STATE__=";
  const at = html.indexOf(marker);
  if (at === -1) return null;

  const start = html.indexOf("{", at + marker.length);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < html.length; i += 1) {
    const ch = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        const raw = html.slice(start, i + 1);
        try {
          return JSON.parse(raw);
        } catch (err) {
          throw new Error(`invalid preloaded state: ${err.message}`);
        }
      }
    }
  }
  return null;
}

function parseSitemap(xml) {
  const urls = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/g;
  let match;
  while ((match = re.exec(xml)) !== null) urls.push(match[1]);
  return urls;
}

/** Run async tasks with bounded concurrency. */
async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function main() {
  await mkdir(path.join(ROOT, "pages"), { recursive: true });
  await mkdir(path.join(ROOT, "state"), { recursive: true });
  await mkdir(path.join(ROOT, "site"), { recursive: true });

  console.log(`Backing up ${SITE} ...`);

  const { body: sitemapXml } = await fetchText(`${SITE}/sitemap.xml`);
  await writeFile(path.join(ROOT, "site", "sitemap.xml"), sitemapXml);

  try {
    const { body: robots } = await fetchText(`${SITE}/robots.txt`);
    await writeFile(path.join(ROOT, "site", "robots.txt"), robots);
  } catch (err) {
    console.warn(`  ! robots.txt not captured: ${err.message}`);
  }

  const urls = [...new Set(parseSitemap(sitemapXml).map((u) => u.replace(/\/$/, "")))];
  if (!urls.includes(SITE)) urls.unshift(SITE);

  console.log(`Found ${urls.length} URLs in sitemap`);

  const manifest = { site: SITE, fetchedAt: new Date().toISOString(), pages: [] };

  await mapPool(urls, CONCURRENCY, async (url) => {
    const { pathname } = new URL(url);
    const slug = slugFor(pathname);

    try {
      const { body: html, status, finalUrl } = await fetchText(url);
      await writeFile(path.join(ROOT, "pages", `${slug}.html`), html);

      let state = null;
      try {
        state = extractPreloadedState(html);
      } catch (err) {
        console.warn(`  ! ${url}: ${err.message}`);
      }
      if (state) {
        await writeFile(
          path.join(ROOT, "state", `${slug}.json`),
          `${JSON.stringify(state, null, 2)}\n`,
        );
      }

      const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
      manifest.pages.push({
        url,
        finalUrl,
        slug,
        status,
        hasState: Boolean(state),
        title: titleMatch ? titleMatch[1].trim() : null,
        html: `pages/${slug}.html`,
        state: state ? `state/${slug}.json` : null,
      });
      console.log(`  \u2713 ${slug}`);
    } catch (err) {
      manifest.pages.push({ url, slug, error: err.message });
      console.warn(`  \u2717 ${url}: ${err.message}`);
    }
  });

  await writeFile(
    path.join(ROOT, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  const ok = manifest.pages.filter((page) => page.status).length;
  console.log(`\nDone: ${ok}/${urls.length} pages captured into _cargo-export/`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
