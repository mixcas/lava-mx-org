#!/usr/bin/env node
/**
 * Phase 2 — Asset pipeline
 * ------------------------
 * Downloads every asset referenced by the extracted content, keeps a full-resolution
 * copy in `_cargo-export/originals/` (git-ignored backup), and writes compact,
 * web-ready masters into `src/assets/`:
 *
 *   images  -> src/assets/images/<key>.webp   (max 2000px, quality 80)
 *   videos  -> src/assets/videos/<key>.mp4    (H.264, max 1920px, faststart)
 *   pdfs    -> src/assets/files/<name>.pdf    (copied + links rewritten locally)
 *   chrome  -> src/assets/images/lava-logo.png, src/assets/favicon.ico
 *
 * Freight/Cargo links to dossier PDFs inside the Markdown are rewritten to
 * relative local paths (`../../assets/files/...`) so they keep working under a
 * custom domain or a GitHub Pages subpath.
 *
 * Node sockets are blocked in this sandbox, so downloads use `curl`.
 *
 * Run: node scripts/fetch-assets.mjs
 */
import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

const execFileAsync = promisify(execFile);

const EXPORT = "_cargo-export";
const ORIGINALS = path.join(EXPORT, "originals");
const IMG_OUT = path.join("src", "assets", "images");
const VID_OUT = path.join("src", "assets", "videos");
const FILE_OUT = path.join("src", "assets", "files");
const CONTENT_DIRS = [path.join("src", "proyectos"), "src"];

const CONCURRENCY = 4;
const IMG_MAX = 3200;
const IMG_QUALITY = 92;

// Site chrome (not part of the project media manifest).
const SITE_ASSETS = [
  {
    url: "https://freight.cargo.site/t/original/i/U1569735500288129372303617426654/LAVA_Logo-01.png",
    out: path.join(IMG_OUT, "lava-logo.png"),
    kind: "logo",
  },
  {
    url: "https://freight.cargo.site/t/original/i/X1598075644497175310775219389662/LAVA_TAB_LOGO_V2.ico",
    out: path.join("src", "assets", "favicon.ico"),
    kind: "favicon",
  },
];

/* ------------------------------------------------------------------ helpers */

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function curl(url, dest, { timeout = 300 } = {}) {
  await mkdir(path.dirname(dest), { recursive: true });
  if (await exists(dest)) return "cached";
  await execFileAsync(
    "curl",
    ["-fsSL", "--max-time", String(timeout), "-A", "lava-mx-migration/1.0 (Phase 2)", "-o", dest, url],
    { maxBuffer: 8 * 1024 * 1024 },
  );
  return "downloaded";
}

/**
 * Some Cargo assets only resolve through a transform path (e.g. direct
 * `/original/` video URLs return 400); fall back to the `/w/1920/` variant.
 */
async function downloadWithFallback(url, dest) {
  const candidates = [url];
  if (url.includes("/original/i/")) candidates.push(url.replace("/original/i/", "/w/1920/i/"));
  let lastError;
  for (const candidate of candidates) {
    try {
      return await curl(candidate, dest);
    } catch (err) {
      lastError = err;
      await execFileAsync("rm", ["-f", dest]).catch(() => {});
    }
  }
  throw lastError;
}

async function mapPool(items, limit, worker) {  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

const human = (bytes) => {
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u += 1;
  }
  return `${n.toFixed(n < 10 && u > 0 ? 1 : 0)}${units[u]}`;
};

/* ------------------------------------------------------------------ process */

async function optimizeImage(src, dest) {
  await mkdir(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.tmp`;
  await sharp(src)
    .rotate()
    .resize({ width: IMG_MAX, height: IMG_MAX, fit: "inside", withoutEnlargement: true })
    .webp({ quality: IMG_QUALITY, effort: 4 })
    .toFile(tmp);
  await execFileAsync("mv", [tmp, dest]);
}

async function transcodeVideo(src, dest) {
  await mkdir(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.tmp.mp4`;
  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-i", src,
      "-vf", "scale='min(1280,iw)':-2",
      "-c:v", "libx264",
      "-crf", "30",
      "-preset", "medium",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "96k",
      "-movflags", "+faststart",
      tmp,
    ],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  await execFileAsync("mv", [tmp, dest]);
}

/* -------------------------------------------------------------------- pdfs */

async function localizeDossierPdfs() {
  const files = [];
  for (const dir of CONTENT_DIRS) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) files.push(path.join(dir, entry.name));
    }
  }

  const urlRe = /https:\/\/freight\.cargo\.site\/m\/[^)\s"]+\.pdf/gi;
  const found = new Map(); // url -> filename
  for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const url of text.match(urlRe) || []) found.set(url, decodeURIComponent(url.split("/").pop()));
  }

  for (const [url, filename] of found) {
    await curl(url, path.join(FILE_OUT, filename));
  }

  // Rewrite links relative to each page's output depth so they work with any
  // pathPrefix. Markdown files become pretty URLs: src/proyectos/x.md -> /proyectos/x/.
  for (const file of files) {
    const text = await readFile(file, "utf8");
    if (!text.match(urlRe)) continue;
    const relDir = path.relative("src", path.dirname(file));
    const segments = relDir ? relDir.split(path.sep).filter(Boolean).length : 0;
    const depth = segments + 1; // +1 for the filename-as-directory pretty URL
    const prefix = "../".repeat(depth) + "assets/files/";
    const rewritten = text.replace(urlRe, (url) => `${prefix}${decodeURIComponent(url.split("/").pop())}`);
    if (rewritten !== text) {
      await writeFile(file, rewritten);
      console.log(`  ~ rewrote PDF links in ${file}`);
    }
  }

  return found.size;
}

/* -------------------------------------------------------------------- main */

async function main() {
  const assets = JSON.parse(await readFile(path.join(EXPORT, "assets.json"), "utf8"));
  console.log(`Fetching ${assets.length} media assets (+ ${SITE_ASSETS.length} site chrome)...`);

  const failures = [];
  let done = 0;

  await mapPool(assets, CONCURRENCY, async (asset) => {
    const original = path.join(ORIGINALS, `${asset.hash || "nohash"}__${asset.name}`);
    const dest = asset.video ? path.join(VID_OUT, asset.key) : path.join(IMG_OUT, asset.key);
    try {
      if (await exists(dest)) {
        done += 1;
        return;
      }
      await downloadWithFallback(asset.url, original);
      if (asset.video) await transcodeVideo(original, dest);
      else await optimizeImage(original, dest);
      done += 1;
      if (done % 20 === 0 || done === assets.length) console.log(`  ... ${done}/${assets.length}`);
    } catch (err) {
      failures.push({ key: asset.key, error: String(err.stderr || err.message).slice(0, 300) });
      console.error(`  x ${asset.key}: ${String(err.stderr || err.message).split("\n")[0]}`);
    }
  });

  // Site chrome.
  for (const asset of SITE_ASSETS) {
    try {
      const original = path.join(ORIGINALS, `_site__${path.basename(asset.url)}`);
      await curl(asset.url, original);
      await mkdir(path.dirname(asset.out), { recursive: true });
      if (asset.kind === "logo") {
        await sharp(original)
          .resize({ width: 1400, withoutEnlargement: true })
          .png({ compressionLevel: 9 })
          .toFile(asset.out);
      } else {
        await execFileAsync("cp", [original, asset.out]);
      }
    } catch (err) {
      failures.push({ key: path.basename(asset.out), error: String(err.message) });
    }
  }

  console.log("Localizing dossier PDFs...");
  const pdfCount = await localizeDossierPdfs();

  // Report output sizes.
  const sizes = {};
  for (const dir of [IMG_OUT, VID_OUT, FILE_OUT]) {
    let total = 0;
    let count = 0;
    if (await exists(dir)) {
      for (const entry of await readdir(dir)) {
        const s = await stat(path.join(dir, entry));
        if (s.isFile()) {
          total += s.size;
          count += 1;
        }
      }
    }
    sizes[path.basename(dir)] = `${count} files, ${human(total)}`;
  }

  console.log("\nOutput:");
  for (const [name, value] of Object.entries(sizes)) console.log(`  ${name}: ${value}`);
  console.log(`PDFs localized: ${pdfCount}`);
  console.log(`Failures: ${failures.length}`);
  for (const f of failures) console.log(`  x ${f.key}: ${f.error}`);
  if (failures.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
