#!/usr/bin/env node
/**
 * Phase 1 — Content extraction
 * ----------------------------
 * Reads the Phase 0 backup (`_cargo-export/`) and generates editable content:
 *
 *   src/proyectos/<slug>.md   one Markdown file per project (front matter = metadata
 *                             + ordered media list; body = the bilingual text column)
 *   src/acerca-de.md          About page (two-column bio + team)
 *   src/_data/site.json       site-wide config (nav labels, emails, meta)
 *   _cargo-export/assets.json download manifest for Phase 2 (key -> original URL)
 *
 * Run: node scripts/extract.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parse } from "node-html-parser";
import TurndownService from "turndown";

const EXPORT = "_cargo-export";
const OUT_PROJECTS = path.join("src", "proyectos");

/* ------------------------------------------------------------------ config */

// Backup slug -> canonical output slug, plus home ordering.
const PROJECTS = [
  { page: "mineralia-indisciplinada", purl: "mineralia-indisciplinada", slug: "mineralia-indisciplinada", current: true, order: 1 },
  { page: "y-las-entranas-gritaron", purl: "y-las-entranas-gritaron", slug: "y-las-entranas-gritaron", current: true, order: 2 },
  { page: "tramas-de-lo-ind-mito-copy", purl: "tramas-de-lo-indómito-copy", slug: "corteza-liquida", current: true, order: 3 },
  { page: "tramas-de-lo-ind-mito", purl: "tramas-de-lo-indómito", slug: "tramas-de-lo-indomito", current: false, order: 1 },
  { page: "tiempos-pendulares", purl: "tiempos-pendulares", slug: "tiempos-pendulares", current: false, order: 2 },
  { page: "infernal-natures", purl: "infernal-natures", slug: "infernal-natures", current: false, order: 3 },
  { page: "penumbra-1", purl: "penumbra-1", slug: "penumbra", current: false, order: 4 },
  { page: "vestigios-metabolicos", purl: "vestigios-metabolicos", slug: "vestigios-metabolicos", current: false, order: 5 },
  { page: "piel-de-proxy", purl: "piel-de-proxy", slug: "piel-de-proxy", current: false, order: 6 },
  { page: "open-studio--christian-wedel", purl: "open-studio:-christian-wedel", slug: "open-studio-christian-wedel", current: false, order: 7 },
  { page: "sangre-y-savia", purl: "sangre-y-savia", slug: "sangre-y-savia", current: false, order: 8 },
  { page: "lianas-neotropicales-1", purl: "lianas-neotropicales-1", slug: "lianas-neotropicales", current: false, order: 9 },
];

const ABOUT = { page: "acerca-de-2", purl: "acerca-de-2" };

const SITE = {
  title: "Lava",
  description:
    "Lava es una plataforma de encuentros transversales entre investigación, gestión y curaduría de prácticas artísticas ubicada en la Ciudad de México.",
  url: "https://lava-mx.org",
  email: "hola@lava-mx.org",
  contactEmail: "info.lavamx@gmail.com",
  contactName: "info.lavamx",
  instagram: "lava__mx",
  city: "Ciudad de México",
  nav: {
    about: { label: "Lava es — Lava is", url: "/acerca-de/" },
    projects: { label: "Proyectos anteriores — Previous projects", url: "/proyectos/" },
  },
};

/* ------------------------------------------------------------------ helpers */

const manifest = JSON.parse(readFileSync(path.join(EXPORT, "manifest.json"), "utf8"));
const entryBySlug = new Map(manifest.pages.map((p) => [p.slug, p]));
const readPage = (slug) => readFileSync(path.join(EXPORT, entryBySlug.get(slug).html), "utf8");
const readState = (slug) => JSON.parse(readFileSync(path.join(EXPORT, entryBySlug.get(slug).state), "utf8"));

const directChildren = (node, tag) =>
  node.childNodes.filter((n) => n.nodeType === 1 && n.rawTagName === tag);

const decodeEntities = (s) =>
  String(s)
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  strongDelimiter: "**",
  br: "\n", // Cargo uses <br> for line breaks; rendered with markdown-it breaks:true
});
turndown.remove(["text-icon"]);
turndown.addRule("emptyPre", {
  filter: (node) => node.nodeName === "PRE" && !node.textContent.trim(),
  replacement: () => "",
});
turndown.addRule("emptyLink", {
  filter: (node) => node.nodeName === "A" && !node.textContent.replace(/\s/g, ""),
  replacement: () => "",
});

const tidy = (s) =>
  s
    .replace(/[ \t]+\n/g, "\n")
    .replace(/^[ \t]+/gm, "") // Cargo used space-padding for layout; avoid code blocks
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
const md = (html) =>
  tidy(
    decodeEntities(turndown.turndown(html || ""))
      .replace(/\u00A0/g, " ")
      .replace(/(\*\*[^*\n]+)\n+\*\*/g, "$1** "), // re-join bold split across breaks
  );
// Short front-matter fields (venue/dates) keep line breaks (rendered by the template).
const plain = (s) => tidy(s);

/* ------------------------------------------------------------------ assets */

const metaByHash = new Map();
for (const p of PROJECTS) {
  const state = readState(p.page);
  for (const page of Object.values(state.pages.byId || {})) {
    for (const m of page.media || []) {
      if (!metaByHash.has(m.hash)) metaByHash.set(m.hash, m);
    }
  }
}

const urlByHash = new Map();
const sitemap = readFileSync(path.join(EXPORT, "site", "sitemap.xml"), "utf8");
for (const match of sitemap.matchAll(/<image:loc>\s*([^<\s]+)\s*<\/image:loc>/g)) {
  const url = match[1];
  const parsed = url.match(/\/i\/([A-Za-z0-9]+)\/([^/]+)$/);
  if (parsed) urlByHash.set(parsed[1], url);
}

const sanitize = (name) => {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot) : "";
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const clean = stem
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${clean || "asset"}${ext.toLowerCase()}`;
};

// Masters are stored as WebP (images) / MP4 (video); keys use those extensions.
const outputName = (name, isVideo) =>
  isVideo
    ? name.replace(/\.(mov|webm|m4v|mp4)$/i, ".mp4")
    : name.replace(/\.(jpe?g|png|gif|tiff?|avif|webp)$/i, ".webp");

const withHash = (base, hash) => {
  const dot = base.lastIndexOf(".");
  const ext = dot > 0 ? base.slice(dot) : "";
  const stem = dot > 0 ? base.slice(0, dot) : base;
  return `${stem}-${String(hash).slice(0, 8)}${ext}`;
};

const assetByHash = new Map();
const assetByName = new Map();

function registerAsset(rec) {
  const existing = rec.hash ? assetByHash.get(rec.hash) : assetByName.get(rec.name);
  if (existing) return existing;
  const name = rec.name || (rec.url ? decodeURIComponent(rec.url.split("/").pop()) : rec.hash);
  const isVideo =
    rec.isVideo ?? (/\.(mp4|mov|webm|m4v)$/i.test(name) || /^video\//.test(rec.mime || ""));
  const record = {
    hash: rec.hash || null,
    name,
    url: rec.url || (rec.hash ? `https://freight.cargo.site/t/original/i/${rec.hash}/${name}` : null),
    width: rec.width ?? null,
    height: rec.height ?? null,
    mime: rec.mime || "",
    isVideo,
    key: null,
  };
  if (record.hash) assetByHash.set(record.hash, record);
  else assetByName.set(record.name, record);
  return record;
}

function resolveHash(hash) {
  const meta = metaByHash.get(hash) || {};
  return registerAsset({
    hash,
    name: meta.name,
    url: urlByHash.get(hash) || meta.url,
    width: meta.width,
    height: meta.height,
    mime: meta.mime_type || meta.mime,
    isVideo: meta.is_video,
  });
}

function resolveUrl(url) {
  const parsed = url.match(/\/i\/([A-Za-z0-9]+)\/([^/?#]+)$/);
  const hash = parsed ? parsed[1] : null;
  const name = parsed ? decodeURIComponent(parsed[2]) : decodeURIComponent(url.split("/").pop());
  if (hash && assetByHash.has(hash)) return assetByHash.get(hash);
  const meta = hash ? metaByHash.get(hash) || {} : {};
  return registerAsset({ hash, name, url, width: meta.width, height: meta.height, mime: meta.mime_type, isVideo: meta.is_video });
}

/* ------------------------------------------------------- page structure */

function findBodycopy(html, purl) {
  const root = parse(html);
  const pageDiv = root
    .querySelectorAll("div.page")
    .find((d) => d.getAttribute("page-url") === purl && !/pinned/.test(d.getAttribute("class") || ""));
  return pageDiv ? pageDiv.querySelector("bodycopy") : null;
}

function extractMedia(unit) {
  const entries = [];
  for (const item of unit.querySelectorAll("media-item")) {
    const hash = item.getAttribute("hash");
    const src = item.getAttribute("src");
    let asset = null;
    if (hash) asset = resolveHash(hash);
    else if (src) asset = resolveUrl(src);
    if (!asset) continue;

    const entry = { asset, video: asset.isVideo };
    if (asset.isVideo) {
      const poster = item.getAttribute("poster");
      if (poster) entry.posterAsset = resolveHash(poster);
      if (item.getAttribute("autoplay") != null) entry.autoplay = true;
      if (item.getAttribute("loop") != null) entry.loop = true;
      if (item.getAttribute("muted") != null) entry.muted = true;
    }
    entries.push(entry);
  }
  return entries;
}

const galleryColumns = (unit) => {
  const gallery = unit.querySelector("gallery-columnized");
  const cols = gallery && Number(gallery.getAttribute("columns"));
  return cols && cols > 0 ? cols : 1;
};

function extractProject(project) {
  const html = readPage(project.page);
  const bodycopy = findBodycopy(html, project.purl);
  if (!bodycopy) throw new Error(`no bodycopy for ${project.purl}`);

  const sets = directChildren(bodycopy, "column-set");
  const unitsOf = (set) => directChildren(set, "column-unit");
  const hasSpan8 = (set) => unitsOf(set).some((u) => u.getAttribute("span") === "8");

  const result = { ...project, media: [], mediaLeft: [], mediaMiddle: [] };

  const threeColumn = sets.length === 1 && unitsOf(sets[0]).length === 3 && !hasSpan8(sets[0]);
  if (threeColumn) {
    const [u0, u1, u2] = unitsOf(sets[0]);
    result.layout = "three-column";
    result.title = decodeEntities(u0.text).trim();
    result.venue = plain(decodeEntities(turndown.turndown(u1.innerHTML))).replace(/\s+/g, " ").trim();
    result.mediaLeft = extractMedia(u0);
    result.mediaMiddle = extractMedia(u1);

    const u2html = u2.innerHTML;
    const brAt = u2html.search(/<br\s*\/?>/i);
    result.dates = plain(decodeEntities(turndown.turndown(brAt === -1 ? "" : u2html.slice(0, brAt)))).trim();
    result.body = tidy(md(brAt === -1 ? u2html : u2html.slice(brAt)));
    return result;
  }

  const header = sets[0];
  const main = sets.find(hasSpan8) || sets[1];
  const headerUnits = unitsOf(header);
  const mainUnits = unitsOf(main);
  const galleryUnit = mainUnits.find((u) => u.getAttribute("span") === "8") || mainUnits[0];
  const textUnit = mainUnits.find((u) => u.getAttribute("span") === "4") || mainUnits[1];

  result.layout = "standard";
  result.title = decodeEntities(headerUnits[0] ? headerUnits[0].text : "").trim();
  result.venue = headerUnits[1] ? plain(decodeEntities(turndown.turndown(headerUnits[1].innerHTML))).trim() : "";
  result.dates = headerUnits[2] ? plain(decodeEntities(turndown.turndown(headerUnits[2].innerHTML))).trim() : "";
  result.media = extractMedia(galleryUnit);
  result.galleryColumns = galleryColumns(galleryUnit);
  result.body = textUnit ? tidy(md(textUnit.innerHTML)) : "";
  return result;
}

function extractAbout() {
  const html = readPage(ABOUT.page);
  const bodycopy = findBodycopy(html, ABOUT.purl);
  if (!bodycopy) throw new Error("no bodycopy for about");
  const sets = directChildren(bodycopy, "column-set");
  const main = sets.find((s) => directChildren(s, "column-unit").some((u) => u.text.trim().length > 40)) || sets[sets.length - 1];
  const units = directChildren(main, "column-unit");
  return {
    title: "Acerca de",
    bio: tidy(md(units[0] ? units[0].innerHTML : "")),
    team: tidy(md(units[1] ? units[1].innerHTML : "")),
  };
}

/* ------------------------------------------------------------- serialise */

const quote = (s) => JSON.stringify(String(s));
const keyValue = (key, value, indent = "") => {
  const text = String(value);
  if (text.includes("\n")) {
    const lines = text.replace(/\s+$/, "").split("\n").map((l) => `${indent}  ${l}`);
    return `${indent}${key}: |-\n${lines.join("\n")}`;
  }
  return `${indent}${key}: ${quote(text)}`;
};

function mediaYaml(list, indent = "") {
  if (!list.length) return [`${indent}media: []`];
  const lines = [`${indent}media:`];
  for (const m of list) {
    lines.push(`${indent}  - src: ${quote(m.asset.key)}`);
    if (m.video) {
      lines.push(`${indent}    video: true`);
      if (m.posterAsset) lines.push(`${indent}    poster: ${quote(m.posterAsset.key)}`);
      if (m.autoplay) lines.push(`${indent}    autoplay: true`);
      if (m.loop) lines.push(`${indent}    loop: true`);
      if (m.muted) lines.push(`${indent}    muted: true`);
    }
  }
  return lines;
}


/* ------------------------------------------------------------------ main */

function main() {
  mkdirSync(OUT_PROJECTS, { recursive: true });

  const projects = PROJECTS.map(extractProject);
  const about = extractAbout();

  // Resolve collision-free keys for every referenced asset.
  const allAssets = new Set();
  for (const m of assetByHash.values()) allAssets.add(m);
  for (const m of assetByName.values()) allAssets.add(m);

  const byName = new Map();
  for (const asset of allAssets) {
    const base = sanitize(outputName(asset.name, asset.isVideo));
    if (!byName.has(base)) byName.set(base, []);
    byName.get(base).push(asset);
  }
  for (const [base, group] of byName) {
    if (group.length === 1) group[0].key = base;
    else for (const asset of group) asset.key = withHash(base, asset.hash || asset.name);
  }

  // Write project Markdown.
  for (const project of projects) {
    const fm = [];
    fm.push(keyValue("title", project.title));
    if (project.venue) fm.push(keyValue("venue", project.venue));
    if (project.dates) fm.push(keyValue("dates", project.dates));
    fm.push(`current: ${project.current}`);
    fm.push(`order: ${project.order}`);
    fm.push(`slug: ${quote(project.slug)}`);
    fm.push(`layout: project`);
    fm.push(`variant: ${project.layout}`);
    if (project.layout === "standard") {
      fm.push(`gallery_columns: ${project.galleryColumns}`);
      fm.push(...mediaYaml(project.media));
    } else {
      fm.push(...mediaYaml(project.mediaLeft).map((l) => l.replace(/^media:/, "media_left:")));
      fm.push(...mediaYaml(project.mediaMiddle).map((l) => l.replace(/^media:/, "media_middle:")));
    }
    const body = project.body.trim();
    const doc = `---\n${fm.join("\n")}\n---\n\n${body}\n`;
    writeFileSync(path.join(OUT_PROJECTS, `${project.slug}.md`), doc);
  }

  // Write About.
  const aboutFm = [
    keyValue("title", about.title),
    `layout: about`,
    keyValue("bio", about.bio),
    keyValue("team", about.team),
  ];
  writeFileSync(path.join("src", "acerca-de.md"), `---\n${aboutFm.join("\n")}\n---\n`);

  // Write site config.
  mkdirSync(path.join("src", "_data"), { recursive: true });
  writeFileSync(path.join("src", "_data", "site.json"), `${JSON.stringify(SITE, null, 2)}\n`);

  // Write the Phase 2 download manifest.
  const manifestAssets = [...allAssets]
    .filter((a) => a.key)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((a) => ({
      key: a.key,
      hash: a.hash,
      name: a.name,
      url: a.url,
      width: a.width,
      height: a.height,
      mime: a.mime,
      video: a.isVideo,
    }));
  writeFileSync(path.join(EXPORT, "assets.json"), `${JSON.stringify(manifestAssets, null, 2)}\n`);

  // Summary.
  console.log(`Projects: ${projects.length}`);
  for (const p of projects) {
    const count = p.layout === "standard" ? p.media.length : p.mediaLeft.length + p.mediaMiddle.length;
    console.log(
      `  ${p.current ? "●" : "○"} ${p.slug.padEnd(30)} order=${p.order} layout=${p.layout.padEnd(12)} media=${count} body=${p.body.length}c` +
        (/(^|\n)\s*\/\/\s*(\n|$)/.test(p.body) ? " [bilingual]" : ""),
    );
  }
  console.log(`Assets: ${manifestAssets.length} unique (see _cargo-export/assets.json)`);
  console.log(`About: bio=${about.bio.length}c team=${about.team.length}c`);
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exitCode = 1;
}
