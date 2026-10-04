#!/usr/bin/env node
/**
 * Tiny static preview server for the built site (`_site/`).
 *
 * Sends `Cache-Control: no-store` so that when images are regenerated (even if
 * a variant keeps the same filename) a browser refresh always fetches fresh
 * bytes. Useful while tuning image quality against the original.
 *
 * Usage: node scripts/dev-server.mjs   (PORT env optional, default 8080)
 */
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";

const ROOT = path.resolve("_site");
const PORT = Number(process.env.PORT || 8080);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".pdf": "application/pdf",
  ".woff2": "font/woff2",
};

const server = http.createServer(async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  let file = path.join(ROOT, urlPath);
  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
  } catch {}

  try {
    const data = await readFile(file);
    const type = MIME[path.extname(file)] || "application/octet-stream";
    const headers = {
      "content-type": type,
      "cache-control": "no-store, no-cache, must-revalidate",
    };
    if (
      /^(text|application\/(javascript|json|xml)|image\/svg)/.test(type) &&
      (req.headers["accept-encoding"] || "").includes("gzip")
    ) {
      headers["content-encoding"] = "gzip";
      headers.vary = "Accept-Encoding";
      res.writeHead(200, headers);
      res.end(gzipSync(data));
    } else {
      res.writeHead(200, headers);
      res.end(data);
    }
  } catch {
    try {
      const notFound = await readFile(path.join(ROOT, "404.html"));
      res.writeHead(404, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(notFound);
    } catch {
      res.writeHead(404, { "cache-control": "no-store" });
      res.end("Not found");
    }
  }
});

server.listen(PORT, () => {
  console.log(`Serving ${ROOT} at http://localhost:${PORT} (cache disabled)`);
});
