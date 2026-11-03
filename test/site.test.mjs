import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { before, describe, it } from "node:test";

import yaml from "js-yaml";
import { NodeType } from "node-html-parser";

import { LEGACY_KEYS } from "../lib/project-contract.js";
import { ASSET_FOLDER, ASSET_URL, FORMATS, GALLERY_TYPES } from "../lib/media-assets.js";
import { projectData, projectFiles, projectRoute } from "./support/content.mjs";
import { buildContentDir, projectFile, writeContentDir } from "./support/contract.mjs";
import {
  ABOUT,
  ARCHIVE_PROJECTS,
  BILINGUAL_PROJECT_COUNT,
  HOMEPAGE_PROJECTS,
  LOCAL_DOCUMENTS,
  PROJECTS,
  PROJECT_COUNT,
  SITE,
  THREE_COLUMN_PROJECT,
  TWO_COLUMN_PROJECTS,
} from "./support/projects.mjs";
import {
  buildPrefixedSite,
  buildSite,
  listOutput,
  listRepoFiles,
  localUrl,
  normalize,
  OUTPUT_DIR,
  PATH_PREFIX,
  readOutputPage,
  readOutputText,
  readPage,
  readRepoFile,
  readText,
  SITE_URL,
  SUBPATH_PREFIX,
} from "./support/site.mjs";
import { BLANK_ROUTE, buildUntranslatedAbout, UNTRANSLATED_ROUTE } from "./support/untranslated-about.mjs";

/** About page route (see GLOSSARY: the collective's identity page). */
const ABOUT_ROUTE = "/acerca-de/";

/**
 * Options every rich-text field declares: Markdown, the Editor/Source switch,
 * and the documents library, so an editor can upload a PDF there and link it
 * (US 30). The text lives in front matter either way.
 */
const RICH_TEXT_OPTIONS = { format: "markdown", switcher: true, media: "documents", categories: ["document"] };

/** The one project that keeps the three-column layout. */
const THREE_COLUMN_ROUTE = THREE_COLUMN_PROJECT.route;

/**
 * The site's languages, read from the one data file that declares them
 * (`src/_data/languages.json`): the prefix of each language tree, its HTML
 * language code, its Open Graph locale, and the name it goes by in its own
 * language — the text the counterpart page's language link carries. A third
 * language would be a third entry there, so every assertion below iterates the
 * file instead of naming a code.
 */
const LANGUAGES = JSON.parse(readRepoFile("src/_data/languages.json"));

/** One declared language, failing loudly when the file no longer declares it. */
function declaredLanguage(code) {
  const entry = LANGUAGES.find((language) => language.code === code);
  assert.ok(entry, `src/_data/languages.json: no "${code}" language declared`);
  return entry;
}

const SPANISH = declaredLanguage("es");
const ENGLISH = declaredLanguage("en");

/** The homepage route in one language tree: its prefix plus "/". */
const homeRoute = (language) => `${language.prefix}/`;

/** The About route in one language tree: its prefix plus the Spanish route. */
const aboutRoute = (language) => `${language.prefix}${ABOUT_ROUTE}`;

/** The project archive route in one language tree: its prefix plus the Spanish route. */
const archiveRoute = (language) => `${language.prefix}/proyectos/`;

/** Whether an absolute (or root-relative) site URL resolves to a built page. */
function isGeneratedUrl(url) {
  const absolute = url?.startsWith("/") ? `${SITE_URL}${url}` : String(url ?? "");
  if (!absolute.startsWith(SITE_URL)) return false;
  const route = absolute.slice(SITE_URL.length);
  const local = route.startsWith(`${PATH_PREFIX}/`) ? route.slice(PATH_PREFIX.length) : route;
  const file = path.join(OUTPUT_DIR, path.extname(local) ? local : path.join(local, "index.html"));
  return fs.existsSync(file);
}

before(async () => {
  await buildSite();
});

/** Project titles as rendered, in document order, on a project-listing page. */
function listedTitles(doc, route) {
  const main = doc.querySelector("main");
  assert.ok(main, `page ${route}: no <main> element`);

  return main.querySelectorAll("article").map((article) => {
    const heading = article.querySelector("h1, h2");
    assert.ok(heading, `page ${route}: an <article> has no project title heading`);
    return normalize(heading.textContent);
  });
}

/** The single project article rendered on a project page. */
function projectArticle(route) {
  const article = readPage(route).querySelector("main article");
  assert.ok(article, `page ${route}: no project article rendered`);
  return article;
}

/** The blocks of a project page's text column, in document order. */
function projectBodyBlocks(route) {
  const body = projectArticle(route).querySelector(".project-body");
  assert.ok(body, `page ${route}: no project text rendered`);
  return body.childNodes
    .filter((node) => node.nodeType === NodeType.ELEMENT_NODE)
    .map((node) => ({ element: node, text: normalize(node.textContent) }));
}

/** The route without its language prefix: `/en/proyectos/x/` → `/proyectos/x/`. */
const routeWithoutLanguage = (route) =>
  LANGUAGES.reduce(
    (value, language) => (language.prefix && value.startsWith(`${language.prefix}/`) ? value.slice(language.prefix.length) : value),
    route,
  );

/** The project content file behind a project route, in either language tree. */
const sourceOf = (route) => projectFiles().find((file) => projectRoute(file) === routeWithoutLanguage(route));

/** The URL of a project page inside one language tree (`/en` + the Spanish route). */
const projectRouteIn = (route, language) => `${language.prefix}${route}`;

/** A written front-matter value, trimmed; a blank one is no value. */
const written = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);

/**
 * What one language version of a project says, read from the content: its own
 * value where it has one, the Spanish value otherwise (ADR-0002: an
 * untranslated field falls back silently). `ownText` is the body that version
 * writes itself, and `null` when its body is the Spanish one.
 */
function projectVersion(route, language) {
  const data = projectData(sourceOf(route));
  const spanish = data.es ?? {};
  const english = language.code === ENGLISH.code ? (data.en ?? {}) : {};
  const own = (field) => written(english[field]) ?? written(spanish[field]);
  return {
    title: own("title") ?? "",
    venue: own("venue"),
    dates: own("dates"),
    ownText: written(english.text),
    text: own("text") ?? "",
  };
}

/**
 * The alt text each gallery image must render in one language version, read
 * from the content: that version's own alt text, then the language-neutral one,
 * then that version's project title, then the Spanish title (ADR-0002).
 */
function expectedImageAlt(route, language) {
  const data = projectData(sourceOf(route));
  const version = projectVersion(route, language);
  const title = language.code === ENGLISH.code ? written(data.en?.title) ?? written(data.es?.title) : written(data.es?.title);
  return (Array.isArray(data.media) ? data.media : [])
    .filter((item) => item.type !== "video")
    .map((item) => written(language.code === ENGLISH.code ? item.alt_en : item.alt_es) ?? written(item.alt) ?? title ?? version.title);
}

/**
 * A translation notice: any wording a page would use to announce that its text
 * is not in the page's language. An untranslated English page shows the Spanish
 * text silently (ADR-0002), so none of these may appear.
 */
const TRANSLATION_NOTICE =
  /sin traducci|no traducid|no hay traducci|no disponible en|solo (en )?espa|not (yet )?translated|no translation|untranslated|translation (is )?(not )?available|available (only )?in spanish/i;

/**
 * Whether a video keeps the browser's control bar. Only a self-sustaining video
 * — autoplay + mute + loop — is decoration with nothing for a viewer to
 * operate; every other video is meant to be operated. Derived from the video's
 * own flags, never from a list of which video on the site is which.
 */
const keepsControls = (video) => !(video.autoplay && video.muted && video.loop);

/**
 * The article for one project on a listing surface (homepage, archive page),
 * found by its rendered title.
 */
function listedArticle(doc, route, title) {
  const article = doc
    .querySelectorAll("article")
    .find((element) => normalize(element.querySelector("h1, h2")?.textContent) === title);
  assert.ok(article, `page ${route}: no article for ${title}`);
  return article;
}

/**
 * Assert the gallery videos rendered inside `container` — a project article,
 * on any surface — against the baseline's videos for that project: source,
 * poster, the autoplay / loop / mute flags, and the control bar those flags
 * call for. Called once per surface (project page, homepage, archive page) so
 * no surface can lose a video's controls on its own.
 */
function assertGalleryVideos(container, project, route) {
  const label = `page ${route}`;
  const videos = container.querySelectorAll("video");
  assert.equal(videos.length, project.videos.length, `${label}: gallery videos rendered`);
  videos.forEach((video, index) => {
    const position = `gallery video ${index + 1}`;
    const expected = project.videos[index];
    assert.equal(video.getAttribute("src"), localUrl(`/assets/videos/${expected.source}`), `${label}: ${position} source`);
    assert.equal(video.hasAttribute("poster"), expected.hasPoster, `${label}: ${position} poster attribute`);
    if (expected.hasPoster) {
      assert.ok(
        (video.getAttribute("poster") ?? "").startsWith(`${PATH_PREFIX}/img/`),
        `${label}: ${position} poster uses the responsive image pipeline`,
      );
    }
    assert.equal(video.hasAttribute("autoplay"), expected.autoplay, `${label}: ${position} autoplay`);
    assert.equal(video.hasAttribute("loop"), expected.loop, `${label}: ${position} loop`);
    assert.equal(video.hasAttribute("muted"), expected.muted, `${label}: ${position} muted`);
    assert.equal(video.hasAttribute("controls"), keepsControls(expected), `${label}: ${position} controls`);
    assert.equal(video.hasAttribute("playsinline"), true, `${label}: ${position} playsinline`);
    assert.equal(video.getAttribute("preload"), "metadata", `${label}: ${position} preload`);
  });
}

describe("project URLs", () => {
  it("keeps all twelve project URLs", () => {
    assert.equal(PROJECTS.length, PROJECT_COUNT, "fixture: expected twelve baseline projects");
    for (const { route } of PROJECTS) {
      assert.doesNotThrow(() => readPage(route), `page ${route}: project URL no longer exists`);
    }
  });

  it("generates one directory per project and no other entry under /proyectos/", () => {
    // `index.html` is the archive page itself; everything else must be a project.
    const generated = listOutput("/proyectos/").filter((entry) => entry !== "index.html");

    assert.deepEqual(
      generated,
      PROJECTS.map(({ route }) => route.split("/")[2]).sort(),
      "page /proyectos/: generated project directories (a stray page or content file such as the directory defaults file would show up here)",
    );
  });

  it("builds every project at its mirrored English URL, with the same slug", () => {
    for (const { route } of PROJECTS) {
      assert.doesNotThrow(() => readPage(projectRouteIn(route, ENGLISH)), `page ${projectRouteIn(route, ENGLISH)}: project URL no longer exists`);
    }

    assert.deepEqual(
      fs.readdirSync(path.join(OUTPUT_DIR, "en", "proyectos")).filter((entry) => entry !== "index.html").sort(),
      PROJECTS.map(({ route }) => route.split("/")[2]).sort(),
      "page /en/proyectos/: the English tree mirrors the twelve project slugs (index.html is the English archive itself)",
    );
  });
});

describe("project content model", () => {
  /** Directory-level defaults shared by every project entry (Eleventy directory data file). */
  const DEFAULTS_FILE = "src/proyectos/proyectos.11tydata.json";

  it("supplies layout, variant, homepage status, order and columns from directory defaults", () => {
    const defaults = JSON.parse(readRepoFile(DEFAULTS_FILE));

    assert.deepEqual(
      defaults,
      {
        layout: "project",
        variant: "standard",
        featured: false,
        order: 0,
        gallery_columns: 1,
        // One source file, one page per language version: the pagination builds
        // the Spanish URL and its English mirror from the same slug (ADR-0002).
        pagination: { data: "languages", size: 1, alias: "lang", resolve: "values", addAllPagesToCollections: true },
        permalink: "{{ lang.prefix }}/proyectos/{{ page.fileSlug }}/",
      },
      `${DEFAULTS_FILE}: project defaults`,
    );
  });

  it("keeps legacy identity keys out of every project file", () => {
    const files = projectFiles();
    assert.equal(files.length, PROJECTS.length, "fixture: expected one content file per project");

    for (const file of files) {
      const keys = Object.keys(projectData(file));
      for (const legacy of Object.keys(LEGACY_KEYS)) {
        assert.ok(!keys.includes(legacy), `${file}: front matter still carries the legacy "${legacy}" key`);
      }
    }
  });

  it("keeps only non-default values in project front matter", () => {
    for (const file of projectFiles()) {
      const keys = projectData(file);

      if ("variant" in keys) {
        assert.equal(keys.variant, "three-column", `${file}: "variant" only appears when it is not the standard variant`);
      }
      if ("gallery_columns" in keys) {
        assert.notEqual(keys.gallery_columns, 1, `${file}: "gallery_columns" only appears when it is not one column`);
      }
      if ("featured" in keys) {
        assert.equal(keys.featured, true, `${file}: "featured" only appears for homepage projects`);
      }
    }
  });

  /** The keys a typed gallery item may carry (see GLOSSARY: Media item). */
  const ITEM_KEYS = {
    image: ["type", "src", "alt_es", "alt_en"],
    video: ["type", "src", "poster", "autoplay", "loop", "mute"],
  };
  /** Media sources are canonical asset paths; the basename names the master. */
  const CANONICAL = Object.fromEntries(
    Object.entries(GALLERY_TYPES).map(([type, { path: prefix }]) => [type, new RegExp(`^${prefix}/[^/]+$`)]),
  );
  const MASTER_DIR = Object.fromEntries(
    Object.entries(GALLERY_TYPES).map(([type, { folder }]) => [type, `src/assets/${folder}`]),
  );

  it("models every project gallery as ordered typed media items", () => {
    const files = projectFiles();
    assert.equal(files.length, PROJECTS.length, "fixture: expected one content file per project");

    for (const file of files) {
      const { media } = projectData(file);
      assert.ok(Array.isArray(media) && media.length > 0, `${file}: "media" is a non-empty gallery list`);

      media.forEach((item, index) => {
        const label = `${file}: media item ${index + 1}`;
        assert.ok(Object.hasOwn(ITEM_KEYS, item.type ?? ""), `${label}: type "${item.type}" is image or video`);
        assert.deepEqual(
          Object.keys(item).filter((key) => !ITEM_KEYS[item.type].includes(key)),
          [],
          `${label}: keys outside the typed media item shape`,
        );
      });
    }
  });

  it("stores media sources as canonical paths that name existing masters", () => {
    for (const file of projectFiles()) {
      const { media } = projectData(file);

      media.forEach((item, index) => {
        const label = `${file}: media item ${index + 1}`;
        assert.match(item.src, CANONICAL[item.type], `${label}: "${item.src}" is a canonical ${item.type} path`);

        const masters = [item.src, item.type === "video" ? item.poster : null].filter(Boolean);
        for (const master of masters) {
          const masterDir = master.startsWith(`${GALLERY_TYPES.image.path}/`) ? MASTER_DIR.image : MASTER_DIR.video;
          assert.doesNotThrow(
            () => readRepoFile(`${masterDir}/${path.posix.basename(master)}`),
            `${label}: master for "${master}" exists`,
          );
        }

        if (item.type === "video") {
          for (const flag of ["autoplay", "loop", "mute"]) {
            if (flag in item) assert.equal(item[flag], true, `${label}: "${flag}" only appears when enabled`);
          }
        }
      });
    }
  });

  it("matches the baseline media count of every project", () => {
    for (const file of projectFiles()) {
      const project = PROJECTS.find(({ route }) => route === projectRoute(file));
      assert.ok(project, `${file}: no baseline project for this content file`);

      const items = projectData(file).media ?? [];
      assert.equal(items.length, project.images + project.videos.length, `${file}: media items in the gallery`);
      assert.equal(
        items.filter((item) => item.type !== "video").length,
        project.images,
        `${file}: gallery images`,
      );
    }
  });

  it("keeps the former left column first in the merged three-column gallery", () => {
    const file = projectFiles().find((candidate) => projectRoute(candidate) === THREE_COLUMN_ROUTE);
    const baseline = PROJECTS.find(({ route }) => route === THREE_COLUMN_ROUTE);
    assert.ok(file && baseline, "fixture: expected the three-column project");

    assert.deepEqual(
      (projectData(file).media ?? []).map((item) => path.posix.basename(item.src)),
      baseline.gallery,
      `${file}: gallery order of the three-column project (former left column, then the middle column)`,
    );
  });

  it("stores each language version in its own object", () => {
    for (const file of projectFiles()) {
      const data = projectData(file);
      const spanish = data.es ?? {};

      assert.ok(
        typeof spanish.title === "string" && spanish.title.trim().length > 0,
        `${file}: "es.title" is the Spanish title and is never empty`,
      );
      assert.ok(
        typeof spanish.text === "string" && spanish.text.trim().length > 0,
        `${file}: "es.text" is the Spanish text and is never empty`,
      );
      assert.ok(!Object.hasOwn(data, "text"), `${file}: the legacy "text" field is gone`);
      for (const flat of ["title", "venue", "dates", "text_es", "text_en"]) {
        assert.ok(
          !Object.hasOwn(data, flat),
          `${file}: the flat "${flat}" key is gone; each value lives in its language object`,
        );
      }

      const baseline = PROJECTS.find((project) => project.route === projectRoute(file));
      assert.ok(baseline, `${file}: no baseline project for this content file`);
      const english = data.en ?? {};
      assert.equal(
        typeof english.text === "string" && english.text.trim().length > 0,
        Boolean(baseline.english),
        `${file}: only the bilingual projects carry an English text, in "en.text"`,
      );
    }
  });

  it("keeps no literal // separator in project text", () => {
    for (const file of projectFiles()) {
      const data = projectData(file);
      for (const key of ["es.text", "en.text"]) {
        const value = key.split(".").reduce((value, step) => value?.[step], data);
        if (typeof value !== "string") continue;
        assert.ok(
          !/^[ \t]*\/\/[ \t]*$/m.test(value),
          `${file}: "${key}" contains a literal // separator line (the template draws the divider)`,
        );
      }
    }
  });

  it("keeps the three-column variant in the one project that uses it", () => {
    for (const file of projectFiles()) {
      assert.equal(
        projectData(file).variant === "three-column",
        projectRoute(file) === THREE_COLUMN_ROUTE,
        `${file}: only the three-column project declares the three-column variant`,
      );
    }
  });
});

describe("Pages CMS project collection (.pages.yml)", () => {
  const config = yaml.load(readRepoFile(".pages.yml"));
  const collection = config.content?.find((entry) => entry.name === "proyectos");

  it("preserves front-matter keys outside the editor schema", () => {
    assert.equal(config.settings?.content?.merge, true, ".pages.yml: settings.content.merge keeps unmanaged keys on save");
  });

  it("edits src/proyectos and hides the directory defaults from the collection", () => {
    assert.ok(collection, ".pages.yml: no `proyectos` collection");
    assert.equal(collection.type, "collection", ".pages.yml: proyectos is a collection");
    assert.equal(collection.path, "src/proyectos", ".pages.yml: proyectos collection path");
    assert.deepEqual(collection.exclude, ["proyectos.11tydata.json"], ".pages.yml: excluded directory defaults file");
    assert.doesNotThrow(
      () => readRepoFile(`${collection.path}/${collection.exclude[0]}`),
      ".pages.yml: the excluded file is the project directory defaults file",
    );
  });

  it("allows creating, renaming and deleting projects", () => {
    for (const operation of ["create", "rename", "delete"]) {
      assert.notEqual(collection.operations?.[operation], false, `.pages.yml: "${operation}" blocked for proyectos`);
    }
  });

  it("shows the filename on create and edit, seeded from the Spanish title", () => {
    assert.deepEqual(
      collection.filename,
      { template: "{primary}.md", field: true },
      ".pages.yml: filename template and visibility",
    );
    // `{primary}` is the list view's primary field, so the filename is seeded
    // from the nested Spanish title — the title that names the public URL.
    assert.equal(
      collection.view?.primary,
      "es.title",
      ".pages.yml: the filename is seeded from the nested Spanish title",
    );
  });

  it("lists the Spanish title, homepage status, order and dates, sorted by order", () => {
    assert.equal(collection.view?.primary, "es.title", ".pages.yml: primary field");
    assert.deepEqual(collection.view?.fields, ["es.title", "featured", "order", "es.dates"], ".pages.yml: list columns");
    assert.deepEqual(collection.view?.sort, ["order", "es.title"], ".pages.yml: sortable columns");
    assert.deepEqual(collection.view?.default, { sort: "order", order: "asc" }, ".pages.yml: default order");
  });

  it("exposes both language versions, homepage status and order with Spanish help text", () => {
    const fields = collection.fields ?? [];
    assert.deepEqual(
      fields.map((field) => field.name),
      ["es", "en", "featured", "order", "gallery_columns", "media"],
      ".pages.yml: project fields",
    );

    for (const field of fields) {
      assert.ok(field.label, `.pages.yml: field "${field.name}" has no label`);
      assert.ok(field.description, `.pages.yml: field "${field.name}" has no description`);
    }

    const byName = (name) => fields.find((field) => field.name === name);
    assert.equal(byName("es").type, "object", ".pages.yml: the Spanish version is one labelled group");
    assert.equal(byName("en").type, "object", ".pages.yml: the English version is one labelled group");
    assert.equal(
      byName("es").fields.find((field) => field.name === "title").required,
      true,
      ".pages.yml: every project has a Spanish title",
    );
    assert.match(byName("es").label, /español/i, ".pages.yml: the Spanish group is labelled in Spanish");
    assert.match(byName("en").label, /inglés/i, ".pages.yml: the English group is labelled in Spanish");
    assert.notEqual(byName("en").required, true, ".pages.yml: the English version is never required");
    assert.equal(byName("featured").type, "boolean", ".pages.yml: featured is a boolean");
    assert.equal(byName("featured").default, false, ".pages.yml: projects start off the homepage");
    assert.equal(byName("order").type, "number", ".pages.yml: order is a number");
    assert.equal(byName("order").default, 0, ".pages.yml: order defaults to zero");
  });

  it("never requires an English value", () => {
    const english = collection.fields.find((field) => field.name === "en");
    assert.deepEqual(
      english.fields.map((field) => field.name),
      ["title", "venue", "dates", "text"],
      ".pages.yml: the English group mirrors the Spanish fields",
    );
    assert.deepEqual(
      english.fields.filter((field) => field.required === true),
      [],
      ".pages.yml: an editor can publish with only the Spanish version written",
    );
  });

  it("edits the Spanish and English project text as Markdown rich text", () => {
    const group = (name) => collection.fields.find((field) => field.name === name);
    const text = (name) => group(name).fields.find((field) => field.name === "text");

    for (const language of ["es", "en"]) {
      assert.equal(text(language)?.type, "rich-text", `.pages.yml: ${language}.text is rich text`);
      assert.deepEqual(
        text(language)?.options,
        RICH_TEXT_OPTIONS,
        `.pages.yml: ${language}.text is Markdown with a source switch and the documents library (an editor uploads a PDF here and links it)`,
      );
    }

    assert.equal(text("es").required, true, ".pages.yml: every project has Spanish text");
    assert.notEqual(text("en").required, true, ".pages.yml: English text is optional");
    assert.match(group("es").label, /español/i, ".pages.yml: the Spanish group is labelled in Spanish");
    assert.match(group("en").label, /inglés/i, ".pages.yml: the English group is labelled in Spanish");
    assert.match(text("es").label, /español/i, ".pages.yml: the Spanish text field is labelled in Spanish");
    assert.match(text("en").label, /inglés/i, ".pages.yml: the English text field is labelled in Spanish");
  });

  it("stores gallery columns as a number of one or two", () => {
    const field = collection.fields.find(({ name }) => name === "gallery_columns");

    assert.equal(field.type, "number", ".pages.yml: gallery columns are stored as a real number");
    assert.deepEqual([field.options.min, field.options.max], [1, 2], ".pages.yml: one or two gallery columns");
  });

  it("keeps the three-column variant out of the editor", () => {
    // The layout variant is a developer-only setting: no field may write it, so
    // merge mode carries the project file's own value through every save.
    const exposed = [...(collection.fields ?? []), ...(collection.view?.fields ?? [])];
    assert.deepEqual(
      exposed.filter((entry) => (typeof entry === "string" ? entry : entry.name) === "variant"),
      [],
      ".pages.yml: the variant is not editable in the CMS",
    );
  });
});

describe("Pages CMS commits (.pages.yml)", () => {
  const config = yaml.load(readRepoFile(".pages.yml"));

  it("attributes each save to the editor who made it", () => {
    assert.equal(
      config.settings?.commit?.identity,
      "user",
      ".pages.yml: settings.commit.identity: user attributes the commit to the editor",
    );
  });
});

describe("Pages CMS about page (.pages.yml)", () => {
  const config = yaml.load(readRepoFile(".pages.yml"));
  const entry = config.content?.find((item) => item.name === "about");

  it("edits the About page as a single file entry", () => {
    assert.ok(entry, ".pages.yml: no `about` entry");
    assert.equal(entry.type, "file", ".pages.yml: the About page is a single-file entry");
    assert.equal(entry.path, "src/acerca-de.md", ".pages.yml: About entry path");
    assert.ok(entry.label, ".pages.yml: the About entry has a label");
    assert.doesNotThrow(() => readRepoFile(entry.path), ".pages.yml: the About entry path is the About page file");
  });

  it("exposes both language versions with Spanish labels", () => {
    const fields = entry?.fields ?? [];
    assert.deepEqual(fields.map((field) => field.name), ["es", "en"], ".pages.yml: About fields");

    for (const field of fields) {
      assert.ok(field.label, `.pages.yml: About field "${field.name}" has no label`);
      assert.ok(field.description, `.pages.yml: About field "${field.name}" has no description`);
      assert.equal(field.type, "object", `.pages.yml: the About "${field.name}" version is one labelled group`);
      assert.deepEqual(
        field.fields.map((nested) => nested.name),
        ["title", "bio", "team"],
        `.pages.yml: the About "${field.name}" version holds its page title, biography and team`,
      );

      const label = (nested) => `.pages.yml: About field "${field.name}.${nested.name}"`;
      const [title, ...richText] = field.fields;
      assert.equal(title.type, "string", `${label(title)} is the page title, a string`);
      for (const nested of richText) {
        assert.ok(nested.label, `${label(nested)} has no label`);
        assert.ok(nested.description, `${label(nested)} has no description`);
        assert.equal(nested.type, "rich-text", `${label(nested)} is rich text`);
        assert.deepEqual(nested.options, RICH_TEXT_OPTIONS, `${label(nested)} is Markdown with a source switch and the documents library`);
      }
    }

    const group = (name) => fields.find((field) => field.name === name);
    const inGroup = (name, nested) => group(name).fields.find((field) => field.name === nested);
    assert.equal(inGroup("es", "title").required, true, ".pages.yml: the Spanish page title is required");
    assert.ok(inGroup("es", "title").description, ".pages.yml: the Spanish page title has help text");
    assert.equal(inGroup("en", "title").required, undefined, ".pages.yml: the English page title is never required");
    assert.equal(inGroup("es", "bio").required, true, ".pages.yml: the About page always has a Spanish biography");
    assert.equal(inGroup("es", "team").required, true, ".pages.yml: the About page always has a Spanish team list");
    assert.deepEqual(
      group("en").fields.filter((nested) => nested.required === true),
      [],
      ".pages.yml: the English title, biography and team are never required",
    );
    assert.match(group("es").label, /español/i, ".pages.yml: the Spanish group is labelled in Spanish");
    assert.match(group("en").label, /inglés/i, ".pages.yml: the English group is labelled in Spanish");
    assert.match(inGroup("es", "title").label, /español/i, ".pages.yml: the Spanish page title is labelled in Spanish");
    assert.match(inGroup("en", "title").label, /inglés/i, ".pages.yml: the English page title is labelled in Spanish");
    assert.match(inGroup("es", "bio").label, /español/i, ".pages.yml: the Spanish biography field is labelled in Spanish");
    assert.match(inGroup("en", "bio").label, /inglés/i, ".pages.yml: the English biography field is labelled in Spanish");
    assert.match(inGroup("es", "team").label, /equipo/i, ".pages.yml: the team field is labelled in Spanish");
  });

  it("keeps the page layout out of the editor so a save preserves it", () => {
    assert.ok(entry, ".pages.yml: no `about` entry");
    // `title` and `layout` are developer-only keys: no field may write them, so
    // merge mode carries the page file's own values through every save.
    const exposed = [...(entry?.fields ?? []), ...(entry?.view?.fields ?? [])].map((field) =>
      typeof field === "string" ? field : field.name,
    );

    for (const name of ["title", "layout", "bio", "bio_es", "bio_en", "team"]) {
      assert.ok(!exposed.includes(name), `.pages.yml: the About "${name}" key is not editable in the CMS`);
    }
    assert.equal(config.settings?.content?.merge, true, ".pages.yml: merge mode keeps the page layout on save");
  });
});

describe("Pages CMS media sources (.pages.yml)", () => {
  const config = yaml.load(readRepoFile(".pages.yml"));
  const sources = Object.fromEntries((config.media ?? []).map((source) => [source.name, source]));

  it("defines image, video and document sources under the folders the site serves", () => {
    assert.deepEqual(Object.keys(sources), Object.keys(ASSET_URL), ".pages.yml: media sources");

    // The same canonical paths and master folders the build reads from
    // `lib/media-assets.js`: the CMS writes what the templates expect.
    const expected = Object.fromEntries(
      Object.keys(ASSET_URL).map((name) => [name, [`src/assets/${ASSET_FOLDER[name]}`, ASSET_URL[name]]]),
    );
    assert.deepEqual(
      Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, [source.input, source.output]])),
      expected,
      ".pages.yml: media source folders and the canonical paths written into content",
    );
  });

  it("accepts only the formats the site can publish", () => {
    assert.deepEqual([...sources.images.extensions].sort(), [...FORMATS.image].sort(), ".pages.yml: image upload formats");
    assert.deepEqual([...sources.videos.extensions].sort(), [...FORMATS.video].sort(), ".pages.yml: video upload formats");
    assert.deepEqual([...sources.documents.extensions].sort(), [...FORMATS.document].sort(), ".pages.yml: document upload formats");
  });

  it("preserves original upload filenames", () => {
    for (const [name, source] of Object.entries(sources)) {
      assert.equal(source.rename, false, `.pages.yml: the "${name}" source keeps original filenames`);
    }
  });

  it("is reachable from every rich-text field, so an editor can upload a document there", () => {
    // The language versions group their fields in `object` fields, so the
    // editor's rich text lives one level below the entry's own fields.
    const richText = (fields = []) =>
      fields.flatMap((field) => [...(field.type === "rich-text" ? [field] : []), ...richText(field.fields)]);
    const fields = (config.content ?? []).flatMap((entry) => richText(entry.fields));
    assert.ok(fields.length > 0, ".pages.yml: expected the rich-text fields of the editor");

    for (const field of fields) {
      const media = field.options?.media;
      assert.ok(media !== false && sources[media], `.pages.yml: the "${field.name}" field inserts from the "${media}" media source`);
    }
  });
});

describe("Pages CMS gallery editor (.pages.yml)", () => {
  const config = yaml.load(readRepoFile(".pages.yml"));
  const field = config.content?.find((entry) => entry.name === "proyectos")?.fields?.find(({ name }) => name === "media");

  it("edits the typed media list as a block list keyed by type", () => {
    assert.ok(field, ".pages.yml: no gallery field");
    assert.equal(field.type, "block", ".pages.yml: the gallery is a block list (one schema per media type)");
    assert.equal(field.list, true, ".pages.yml: gallery items are a reorderable list");
    assert.equal(field.blockKey, "type", ".pages.yml: the media item type is stored under `type`");
    assert.deepEqual(field.blocks.map(({ name }) => name), ["image", "video"], ".pages.yml: media item types");
  });

  it("stores canonical sources chosen from the media sources", () => {
    const [image, video] = field.blocks;
    const blockField = (block, name) => block.fields.find((entry) => entry.name === name);

    assert.deepEqual(
      [blockField(image, "src").type, blockField(image, "src").options.media],
      ["image", "images"],
      ".pages.yml: image sources are picked from the image source",
    );
    assert.deepEqual(
      [blockField(video, "src").type, blockField(video, "src").options.media],
      ["file", "videos"],
      ".pages.yml: video sources are picked from the video source",
    );
    assert.deepEqual(
      [blockField(video, "poster").type, blockField(video, "poster").options.media],
      ["image", "images"],
      ".pages.yml: video posters are images",
    );
  });

  it("lets editors write alt text in each language, a poster and the playback flags", () => {
    const [image, video] = field.blocks;

    for (const [name, language] of [
      ["alt_es", /español/i],
      ["alt_en", /inglés/i],
    ]) {
      const alt = image.fields.find((entry) => entry.name === name);
      assert.equal(alt?.type, "string", `.pages.yml: image "${name}" text field`);
      assert.notEqual(alt?.required, true, `.pages.yml: "${name}" is optional (it falls back to the project title)`);
      assert.match(alt.label, language, `.pages.yml: "${name}" is labelled in Spanish as the ${name.slice(-2)} alt text`);
    }
    assert.deepEqual(
      image.fields.map((entry) => entry.name),
      ["src", "alt_es", "alt_en"],
      ".pages.yml: an image carries one alt text per language, not one for both",
    );

    for (const name of ["autoplay", "loop", "mute"]) {
      const flag = video.fields.find((entry) => entry.name === name);
      assert.equal(flag?.type, "boolean", `.pages.yml: video "${name}" flag`);
    }
  });

  it("labels every media field in Spanish", () => {
    for (const block of field.blocks) {
      assert.ok(block.label, `.pages.yml: the "${block.name}" block has no label`);
      for (const entry of block.fields) {
        assert.ok(entry.label, `.pages.yml: media field "${block.name}.${entry.name}" has no label`);
        assert.ok(entry.description, `.pages.yml: media field "${block.name}.${entry.name}" has no description`);
      }
    }
  });
});

describe("Pages CMS site settings (.pages.yml)", () => {
  const config = yaml.load(readRepoFile(".pages.yml"));
  const entry = config.content?.find((item) => item.name === "site");

  it("edits the settings file as a JSON single-file entry", () => {
    assert.ok(entry, ".pages.yml: no `site` entry");
    assert.equal(entry.type, "file", ".pages.yml: the settings file is a single-file entry");
    assert.equal(entry.path, "src/_data/site.json", ".pages.yml: settings entry path");
    assert.equal(entry.format, "json", ".pages.yml: settings are JSON, not front matter");
    assert.ok(entry.label, ".pages.yml: the settings entry has a label");
    assert.ok(entry.description, ".pages.yml: the settings entry has a description");
    assert.doesNotThrow(() => readRepoFile(entry.path), ".pages.yml: the settings entry path is the settings file");
  });

  it("exposes every settings key, including the ones no template reads", () => {
    const settingsFile = JSON.parse(readRepoFile("src/_data/site.json"));
    assert.deepEqual(
      settingsPaths(entry?.fields ?? []),
      settingsPathsOfData(settingsFile),
      ".pages.yml: every key in site.json is editable in the CMS",
    );
  });

  it("labels every field and says whether it changes what visitors see", () => {
    const settingsFile = JSON.parse(readRepoFile("src/_data/site.json"));
    const fields = entry?.fields ?? [];
    // The `es` and `en` objects hold the same slots for the two language
    // versions of a page (description, footer, navigation), so the language
    // object itself is not what decides whether a setting reaches the output: a
    // template reading `site.es.footer.city` speaks for `en.footer.city` too.
    const slot = (path) => path.replace(/^(es|en)(\.|$)/, "");
    const read = templateSettingsPaths().map(slot).filter(Boolean);
    // A path is read when a template reads it, or something below it. The `es`
    // and `en` objects are read whenever anything inside either one is.
    const readsPath = (fieldPath) => {
      const own = slot(fieldPath);
      return own === ""
        ? read.length > 0
        : read.some((path) => path === own || path.startsWith(`${own}.`));
    };

    for (const fieldPath of settingsPathsOfData(settingsFile)) {
      const field = settingsField(fields, fieldPath);
      assert.ok(field?.label, `.pages.yml: settings field "${fieldPath}" has no label`);
      assert.ok(field?.description, `.pages.yml: settings field "${fieldPath}" has no description`);

      if (readsPath(fieldPath)) {
        assert.doesNotMatch(
          field.description,
          /no afecta/i,
          `.pages.yml: settings field "${fieldPath}" changes the site, so it must not say it does not`,
        );
        assert.match(
          field.description,
          /cambia|se ve|se muestra|aparece/i,
          `.pages.yml: settings field "${fieldPath}" must say what it changes`,
        );
      } else {
        assert.match(
          field.description,
          /no afecta/i,
          `.pages.yml: settings field "${fieldPath}" changes nothing, so it must say so`,
        );
      }
    }
  });

  it("edits the navigation aria-label and the hidden page headings, per language", () => {
    const fields = entry?.fields ?? [];

    for (const language of LANGUAGES) {
      for (const name of ["navLabel", "homeHeading", "archiveHeading"]) {
        const field = settingsField(fields, `${language.code}.${name}`);
        assert.ok(field, `.pages.yml: settings field "${language.code}.${name}" is editable`);
        assert.ok(field.label, `.pages.yml: settings field "${language.code}.${name}" has a label`);
        assert.ok(field.description, `.pages.yml: settings field "${language.code}.${name}" has a description`);
      }
    }

    // The chrome strings are the settings' own, not a copy hardwired in a
    // template: each language version renders its own.
    const settingsFile = JSON.parse(readRepoFile("src/_data/site.json"));
    for (const language of LANGUAGES) {
      const doc = readPage(homeRoute(language));
      assert.equal(
        normalize(doc.querySelector(".site-nav")?.getAttribute("aria-label")),
        settingsFile[language.code].navLabel,
        `page ${homeRoute(language)}: nav aria-label comes from the settings`,
      );
      assert.equal(
        normalize(doc.querySelector("main h1")?.textContent),
        settingsFile[language.code].homeHeading,
        `page ${homeRoute(language)}: hidden heading comes from the settings`,
      );
    }
  });

  it("round-trips a settings save and keeps keys the schema does not know", () => {
    const settingsFile = JSON.parse(readRepoFile("src/_data/site.json"));

    // What the CMS writes back: one value per schema field, nested objects
    // rebuilt from their own fields. Merge mode then layers that over the
    // file, so a save with no edits must reproduce the file exactly.
    const submitted = submittedSettings(entry?.fields ?? [], settingsFile);
    assert.deepEqual(submitted, settingsFile, ".pages.yml: saving settings without edits rewrites site.json unchanged");
    assert.equal(config.settings?.content?.merge, true, ".pages.yml: merge mode keeps settings outside the schema");

    // A setting added to the file after the schema was written is not in the
    // editor; merge mode must still carry it through the save.
    const withUnmanaged = { ...structuredClone(settingsFile), unmanagedSetting: "valor" };
    assert.deepEqual(
      mergeSettings(withUnmanaged, submitted),
      withUnmanaged,
      ".pages.yml: a settings save preserves keys outside the editor schema",
    );
  });
});

/** The values a CMS save submits: one per declared field, nested objects rebuilt. */
function submittedSettings(fields, data) {
  return Object.fromEntries(
    fields.map((field) => [
      field.name,
      field.type === "object" ? submittedSettings(field.fields ?? [], data?.[field.name] ?? {}) : data?.[field.name],
    ]),
  );
}

/** Merge mode: submitted values win, keys outside the schema survive. */
function mergeSettings(existing, submitted) {
  const merged = structuredClone(existing);
  for (const [key, value] of Object.entries(submitted)) {
    const nested = value !== null && typeof value === "object" && !Array.isArray(value);
    merged[key] =
      nested && merged[key] !== null && typeof merged[key] === "object"
        ? mergeSettings(merged[key], value)
        : value;
  }
  return merged;
}

/** Field at a dotted settings path, if the entry declares one. */
function settingsField(fields, fieldPath) {
  const [head, ...rest] = fieldPath.split(".");
  const field = fields?.find((candidate) => candidate.name === head);
  return rest.length ? settingsField(field?.fields, rest.join(".")) : field;
}

/** Dotted `site.*` paths the templates read: the settings that reach the output. */
function templateSettingsPaths() {
  const templates = listRepoFiles("src").filter((file) => /\.(njk|md|html)$/.test(file));
  return [...new Set(templates.flatMap((file) => settingsPathsInTemplate(readRepoFile(file))))].sort();
}

/**
 * The `site.*` paths one template reads. A path written for a single language
 * object (`site.es.footer.city`) speaks for the same slot in every language;
 * a language picked while rendering (`site[language.code].footer.city`) names
 * the slot only, so it stands for that path under each declared language.
 */
function settingsPathsInTemplate(source) {
  const literal = [...source.matchAll(/\bsite\.([A-Za-z0-9_.]+)/g)].map((match) => match[1].replace(/\.$/, ""));
  const indexed = [...source.matchAll(/\bsite\[[^\]]+\](?:\.([A-Za-z0-9_.]*))?/g)].flatMap((match) => {
    const slot = (match[1] ?? "").replace(/\.$/, "");
    return LANGUAGES.map((language) => (slot ? `${language.code}.${slot}` : language.code));
  });
  return [...literal, ...indexed];
}

/** Dotted paths of the settings entry's fields, nested objects included. */
function settingsPaths(fields, prefix = "") {
  return fields
    .flatMap((field) => {
      const path = prefix ? `${prefix}.${field.name}` : field.name;
      return [path, ...(field.type === "object" ? settingsPaths(field.fields ?? [], path) : [])];
    })
    .sort();
}

/** Dotted paths of every key in the settings data, nested objects included. */
function settingsPathsOfData(data, prefix = "") {
  return Object.entries(data)
    .flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      const nested = value !== null && typeof value === "object" && !Array.isArray(value);
      return [path, ...(nested ? settingsPathsOfData(value, path) : [])];
    })
    .sort();
}

describe("the site's languages (src/_data/languages.json)", () => {
  it("declares Spanish at the root and English under /en/", () => {
    assert.deepEqual(
      LANGUAGES.map((language) => language.code),
      ["es", "en"],
      "languages.json: the site's languages, Spanish first",
    );
    assert.equal(SPANISH.prefix, "", "languages.json: Spanish keeps the root of the site");
    assert.equal(ENGLISH.prefix, "/en", "languages.json: English mirrors the site under /en");

    assert.equal(SPANISH.locale, "es_MX", "languages.json: the Spanish Open Graph locale");
    assert.equal(ENGLISH.locale, "en_US", "languages.json: the English Open Graph locale");
  });

  it("names each language in its own language, for the counterpart page's link", () => {
    // The link on the Spanish page names English in English, and the other way
    // round: a reader who does not read the page's language still recognises it.
    assert.equal(SPANISH.label, "Español", "languages.json: the Spanish language's own name");
    assert.equal(ENGLISH.label, "English", "languages.json: the English language's own name");
  });

  it("has a settings object for every declared language", () => {
    const settings = JSON.parse(readRepoFile("src/_data/site.json"));
    for (const language of LANGUAGES) {
      assert.ok(settings[language.code], `site.json: no "${language.code}" object for the declared language`);
    }
  });
});

describe("homepage in both languages", () => {
  it("serves the Spanish homepage at the root and the English one at its mirrored URL", () => {
    for (const language of LANGUAGES) {
      const doc = readPage(homeRoute(language));
      assert.equal(doc.querySelector("html")?.getAttribute("lang"), language.code, `page ${homeRoute(language)}: <html lang>`);
    }
  });

  it("keeps the root URL serving the Spanish homepage, with no redirect or chooser", () => {
    const doc = readPage("/");
    assert.equal(doc.querySelector("html")?.getAttribute("lang"), "es", "page /: the root page is the Spanish homepage");
    assert.equal(doc.querySelectorAll('meta[http-equiv="refresh"]').length, 0, "page /: no redirect");
    assert.equal(normalize(doc.querySelector("title")?.textContent), SITE.title, "page /: the site's own page, not a chooser");
  });

  it("renders the chrome in the page's own language", () => {
    const settings = JSON.parse(readRepoFile("src/_data/site.json"));
    const expected = {
      es: { navLabel: "Principal", heading: /proyectos actuales/ },
      en: { navLabel: "Main", heading: /current projects/ },
    };

    for (const language of LANGUAGES) {
      const route = homeRoute(language);
      const doc = readPage(route);
      const label = `page ${route}`;
      const chrome = settings[language.code];

      assert.equal(chrome.navLabel, expected[language.code].navLabel, `site.json: the ${language.code} nav label`);
      assert.equal(normalize(doc.querySelector(".site-nav")?.getAttribute("aria-label")), chrome.navLabel, `${label}: nav aria-label`);
      assert.equal(
        normalize(doc.querySelector(`header a[href="${localUrl(`${language.prefix}/acerca-de/`)}"]`)?.textContent),
        chrome.nav.about.label,
        `${label}: the About link is labelled in the page's language`,
      );
      assert.equal(
        normalize(doc.querySelector(`header a[href="${localUrl(`${language.prefix}/proyectos/`)}"]`)?.textContent),
        chrome.nav.projects.label,
        `${label}: the archive link is labelled in the page's language`,
      );

      const footer = normalize(doc.querySelector(".site-footer")?.textContent);
      for (const value of [chrome.footer.copyright, chrome.footer.city, chrome.footer.instagram]) {
        assert.ok(footer.includes(value), `${label}: footer shows "${value}"`);
      }

      const heading = normalize(doc.querySelector("main h1")?.textContent);
      assert.equal(heading, chrome.homeHeading, `${label}: the hidden heading is the page language's own`);
      assert.match(heading, expected[language.code].heading, `${label}: hidden heading`);
    }
  });

  it("links to the counterpart language version of the same page with a plain anchor", () => {
    for (const language of LANGUAGES) {
      const route = homeRoute(language);
      const doc = readPage(route);
      const label = `page ${route}`;
      const other = LANGUAGES.find((candidate) => candidate.code !== language.code);

      const links = doc.querySelectorAll("header a[hreflang]");
      assert.equal(links.length, 1, `${label}: one language link in the header`);
      const link = links[0];
      assert.equal(link.getAttribute("href"), localUrl(homeRoute(other)), `${label}: the language link points at the counterpart page`);
      assert.equal(link.getAttribute("hreflang"), other.code, `${label}: the link declares the language it leads to`);
      assert.equal(link.getAttribute("lang"), other.code, `${label}: the link text is written in the language it names`);
      assert.equal(normalize(link.textContent), other.label, `${label}: the link names the language in its own language`);

      // No script, no cookie, no auto-detection: the link works with JavaScript off.
      assert.equal(doc.querySelectorAll("script").length, 0, `${label}: the language link needs no script`);
    }
  });

  it("declares hreflang, the page locale and its alternate, and a self canonical", () => {
    const homeUrls = Object.fromEntries(LANGUAGES.map((language) => [language.code, `${SITE_URL}${localUrl(homeRoute(language))}`]));

    for (const language of LANGUAGES) {
      const route = homeRoute(language);
      const doc = readPage(route);
      const label = `page ${route}`;
      const other = LANGUAGES.find((candidate) => candidate.code !== language.code);

      const hreflang = Object.fromEntries(
        doc.querySelectorAll('link[rel="alternate"]').map((link) => [link.getAttribute("hreflang"), link.getAttribute("href")]),
      );
      assert.deepEqual(
        hreflang,
        {
          [SPANISH.code]: homeUrls[SPANISH.code],
          [ENGLISH.code]: homeUrls[ENGLISH.code],
          "x-default": homeUrls[SPANISH.code],
        },
        `${label}: hreflang links, x-default pointing at the Spanish homepage`,
      );

      assert.equal(doc.querySelector('meta[property="og:locale"]')?.getAttribute("content"), language.locale, `${label}: og:locale`);
      assert.deepEqual(
        doc.querySelectorAll('meta[property="og:locale:alternate"]').map((meta) => meta.getAttribute("content")),
        [other.locale],
        `${label}: og:locale:alternate names the other language version`,
      );

      assert.equal(doc.querySelector('link[rel="canonical"]')?.getAttribute("href"), `${SITE_URL}${localUrl(route)}`, `${label}: self canonical`);
    }
  });

  it("titles and describes each homepage in its own language", () => {
    const descriptions = { [SPANISH.code]: SITE.description, [ENGLISH.code]: SITE.englishDescription };

    for (const language of LANGUAGES) {
      const route = homeRoute(language);
      const doc = readPage(route);
      assert.equal(normalize(doc.querySelector("title")?.textContent), SITE.title, `page ${route}: <title>`);
      assert.equal(
        normalize(doc.querySelector('meta[name="description"]')?.getAttribute("content")),
        descriptions[language.code],
        `page ${route}: meta description is the page language's own`,
      );
    }
  });

  it("renders no navigation label that mixes the two languages", () => {
    const mixed = ["Lava es — Lava is", "Proyectos anteriores — Previous projects"];
    for (const route of [...LANGUAGES.map(homeRoute), ...LANGUAGES.map(aboutRoute), "/proyectos/"]) {
      const html = readText(path.posix.join(route, "index.html"));
      for (const label of mixed) {
        assert.ok(!html.includes(label), `page ${route}: no half-and-half label "${label}"`);
      }
    }

    const settings = JSON.parse(readRepoFile("src/_data/site.json"));
    assert.equal(settings.es.nav.about.label, "Lava es", "site.json: the Spanish About label is Spanish only");
    assert.equal(settings.es.nav.projects.label, "Proyectos anteriores", "site.json: the Spanish archive label is Spanish only");
    assert.equal(settings.en.nav.about.label, "Lava is", "site.json: the English About label is English");
    assert.equal(settings.en.nav.projects.label, "Previous projects", "site.json: the English archive label is English");
  });
});

describe("language alternates follow the routes that were built", () => {
  /** The pages this phase still builds in Spanish only. */
  const SPANISH_ONLY = ["/404.html"];
  /** The pages built in both languages: each home, each About page, each archive and both versions of each project. */
  const PAIRED = [
    ...LANGUAGES.map(homeRoute),
    ...LANGUAGES.map(aboutRoute),
    ...LANGUAGES.map(archiveRoute),
    ...LANGUAGES.flatMap((language) => PROJECTS.map((project) => projectRouteIn(project.route, language))),
  ];

  it("advertises no English version of a page that exists in Spanish only", () => {
    for (const route of SPANISH_ONLY) {
      const doc = readPage(route);
      const label = `page ${route}`;

      assert.equal(doc.querySelector("html")?.getAttribute("lang"), "es", `${label}: page language`);
      assert.deepEqual(
        doc.querySelectorAll('link[rel="alternate"]').map((link) => link.getAttribute("hreflang")),
        [],
        `${label}: no hreflang, since no English counterpart was built`,
      );
      assert.equal(doc.querySelectorAll('meta[property="og:locale:alternate"]').length, 0, `${label}: no alternate locale`);
      assert.equal(doc.querySelectorAll("header a[hreflang]").length, 0, `${label}: no language link`);
    }
  });

  it("advertises both language versions of every project page, and links to the counterpart", () => {
    for (const project of PROJECTS) {
      for (const language of LANGUAGES) {
        const counterpart = LANGUAGES.find((candidate) => candidate.code !== language.code);
        const route = projectRouteIn(project.route, language);
        const doc = readPage(route);
        const label = `page ${route}`;

        assert.equal(doc.querySelector("html")?.getAttribute("lang"), language.code, `${label}: page language`);
        assert.deepEqual(
          doc.querySelectorAll('link[rel="alternate"]').map((link) => link.getAttribute("href")),
          [
            `${SITE_URL}${localUrl(projectRouteIn(project.route, SPANISH))}`,
            `${SITE_URL}${localUrl(projectRouteIn(project.route, ENGLISH))}`,
            `${SITE_URL}${localUrl(projectRouteIn(project.route, SPANISH))}`,
          ],
          `${label}: hreflang for both versions and x-default on the Spanish one`,
        );
        assert.equal(
          doc.querySelector('meta[property="og:locale:alternate"]')?.getAttribute("content"),
          counterpart.locale,
          `${label}: the alternate locale`,
        );

        const link = doc.querySelector("header a[hreflang]");
        assert.equal(link?.getAttribute("href"), localUrl(projectRouteIn(project.route, counterpart)), `${label}: the language link reaches the counterpart project page`);
        assert.equal(normalize(link?.textContent), counterpart.label, `${label}: the language link names the other language in its own language`);
      }
    }
  });

  it("never points a language link or an hreflang at a page the build does not produce", () => {
    const pages = [...PAIRED, ...SPANISH_ONLY];

    for (const route of pages) {
      const doc = readPage(route);
      const urls = [
        ...doc.querySelectorAll('link[rel="alternate"]').map((link) => link.getAttribute("href")),
        ...doc.querySelectorAll("header a[hreflang]").map((link) => link.getAttribute("href")),
      ];
      for (const url of urls) {
        assert.ok(isGeneratedUrl(url), `page ${route}: ${url} resolves to a page the build produced`);
      }
    }
  });
});

describe("sitemap (/sitemap.xml)", () => {
  const route = "/sitemap.xml";
  const xml = () => readText(route);

  it("lists every page in every language version it was built in", () => {
    const listed = [...xml().matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    const routes = [
      ...LANGUAGES.map(homeRoute),
      ...LANGUAGES.map(aboutRoute),
      ...LANGUAGES.map(archiveRoute),
      ...LANGUAGES.flatMap((language) => PROJECTS.map((project) => projectRouteIn(project.route, language))),
    ];

    assert.deepEqual(
      listed.sort(),
      routes.map((listedRoute) => `${SITE_URL}${localUrl(listedRoute)}`).sort(),
      `page ${route}: listed URLs`,
    );
  });

  it("carries xhtml alternates for every route built in both languages, none for a single-language page", () => {
    assert.ok(xml().includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"'), `page ${route}: declares the xhtml namespace`);

    const entries = [...xml().matchAll(/<url>[\s\S]*?<\/url>/g)].map(([block]) => ({
      loc: block.match(/<loc>([^<]+)<\/loc>/)?.[1],
      alternates: [...block.matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map(([, hreflang, href]) => [
        hreflang,
        href,
      ]),
    }));
    assert.ok(entries.length > 0, `page ${route}: no <url> entries`);

    // Every route built in both languages — the homepages, the About pages, the
    // archives and all twelve projects — carries the same three alternates,
    // keyed by that route's own pair of URLs; a single-language page carries
    // none (ADR-0002).
    const pairedRoutes = [
      homeRoute,
      aboutRoute,
      archiveRoute,
      ...PROJECTS.map((project) => (language) => projectRouteIn(project.route, language)),
    ];

    for (const ofRoute of pairedRoutes) {
      const expected = [
        [SPANISH.code, `${SITE_URL}${localUrl(ofRoute(SPANISH))}`],
        [ENGLISH.code, `${SITE_URL}${localUrl(ofRoute(ENGLISH))}`],
        ["x-default", `${SITE_URL}${localUrl(ofRoute(SPANISH))}`],
      ];
      for (const language of LANGUAGES) {
        const loc = `${SITE_URL}${localUrl(ofRoute(language))}`;
        const entry = entries.find((candidate) => candidate.loc === loc);
        assert.ok(entry, `page ${route}: ${loc} is listed`);
        assert.deepEqual(entry.alternates, expected, `page ${route}: ${loc} carries the alternates of its route`);
      }
    }

    const bilingualLocs = new Set(
      pairedRoutes.flatMap((ofRoute) => LANGUAGES.map((language) => `${SITE_URL}${localUrl(ofRoute(language))}`)),
    );
    for (const entry of entries.filter((candidate) => !bilingualLocs.has(candidate.loc))) {
      assert.deepEqual(entry.alternates, [], `page ${route}: ${entry.loc} was built in one language, so it carries no alternate`);
    }
  });

  it("keeps robots.txt advertising exactly one sitemap", () => {
    const robots = readText("/robots.txt");
    assert.equal((robots.match(/^Sitemap:/gim) ?? []).length, 1, "robots.txt: exactly one sitemap line");
    assert.match(robots, new RegExp(`^Sitemap: ${SITE_URL}${localUrl(route)}$`, "m"), "robots.txt: advertises the sitemap");
  });
});

describe("homepage (/)", () => {
  const route = "/";

  it("lists exactly the three homepage projects, in order", () => {
    assert.deepEqual(
      listedTitles(readPage(route), route),
      HOMEPAGE_PROJECTS.map((project) => project.title),
      `page ${route}: homepage project titles and order`,
    );
  });

  it("lists each homepage project in the page's language, on both homepages", () => {
    for (const language of LANGUAGES) {
      const pageRoute = homeRoute(language);
      assert.deepEqual(
        listedTitles(readPage(pageRoute), pageRoute),
        HOMEPAGE_PROJECTS.map((project) => projectVersion(project.route, language).title),
        `page ${pageRoute}: homepage project titles in ${language.code}, in order`,
      );
    }
  });

  // Every homepage project is translated today, so the fallback branch is a
  // guard for when an editor selects an untranslated one: it must read in
  // Spanish and say so, on the English homepage too.
  it("renders each listed project's text in the page's language, marking the Spanish fallback", () => {
    for (const language of LANGUAGES) {
      const pageRoute = homeRoute(language);

      for (const project of HOMEPAGE_PROJECTS) {
        const title = projectVersion(project.route, language).title;
        const article = listedArticle(readPage(pageRoute), pageRoute, title);
        const body = article.querySelector(".project-body");
        assert.ok(body, `page ${pageRoute}: no project text for ${title}`);
        const bodyText = normalize(body.textContent);

        if (language.code === SPANISH.code || project.english) {
          assert.ok(
            bodyText.includes(language.code === SPANISH.code ? project.spanish : project.english),
            `page ${pageRoute}: ${title} reads in ${language.code}`,
          );
        } else {
          assert.ok(bodyText.includes(project.spanish), `page ${pageRoute}: ${title} falls back to its Spanish text`);
          assert.equal(body.getAttribute("lang"), SPANISH.code, `page ${pageRoute}: ${title}'s fallback body declares Spanish`);
        }
      }
    }
  });

  // The homepage renders the same gallery as the project page, so a listed
  // video must keep its control bar here too.
  it("renders every listed gallery video with the control bar its flags call for", () => {
    const doc = readPage(route);
    for (const project of HOMEPAGE_PROJECTS.filter(({ videos }) => videos.length)) {
      assertGalleryVideos(listedArticle(doc, route, project.title), project, route);
    }
  });
});

describe("archive page in both languages", () => {
  const settings = JSON.parse(readRepoFile("src/_data/site.json"));
  /** Venue and dates may carry Markdown (bold, a line break): compare as text. */
  const plain = (value) => normalize(String(value ?? "").replace(/\*/g, ""));

  it("keeps the Spanish archive at its URL and serves the English one at its mirror", () => {
    for (const language of LANGUAGES) {
      const route = archiveRoute(language);
      assert.equal(readPage(route).querySelector("html")?.getAttribute("lang"), language.code, `page ${route}: <html lang>`);
    }
    assert.equal(archiveRoute(SPANISH), "/proyectos/", "the Spanish archive keeps its public URL");
    assert.equal(archiveRoute(ENGLISH), "/en/proyectos/", "the English archive mirrors the Spanish path segment");
  });

  it("heads each archive in the page's own language", () => {
    // The Spanish heading is the glossary's public label for the archive; the
    // English one is English, and neither is hardcoded in the template.
    assert.equal(settings[SPANISH.code].archiveHeading, "Proyectos anteriores", "site.json: the Spanish archive heading");
    assert.notEqual(settings[ENGLISH.code].archiveHeading, settings[SPANISH.code].archiveHeading, "site.json: the English archive heading is English");
    assert.doesNotMatch(settings[ENGLISH.code].archiveHeading, /proyectos anteriores/i, "site.json: the English archive heading is not the Spanish one");

    for (const language of LANGUAGES) {
      const route = archiveRoute(language);
      const doc = readPage(route);
      assert.equal(
        normalize(doc.querySelector("main h1")?.textContent),
        settings[language.code].archiveHeading,
        `page ${route}: the hidden heading is the page language's own`,
      );
      assert.equal(
        normalize(doc.querySelector("title")?.textContent),
        `${settings[language.code].archiveHeading} — ${SITE.title}`,
        `page ${route}: <title> is the page language's own`,
      );
    }
  });

  it("lists the same projects in the same order on both archives", () => {
    // Membership and order are language-independent: the archive lists the
    // same archive projects, in their `order`, whatever the page language.
    const listed = LANGUAGES.map((language) => {
      const route = archiveRoute(language);
      return readPage(route)
        .querySelectorAll("main article")
        .map((article) => article.querySelector("a")?.getAttribute("href"));
    });

    for (const [index, language] of LANGUAGES.entries()) {
      assert.deepEqual(
        listed[index],
        ARCHIVE_PROJECTS.map((project) => localUrl(projectRouteIn(project.route, language))),
        `page ${archiveRoute(language)}: archive project links and order`,
      );
    }

    const routes = listed.map((hrefs) => hrefs.map((href) => routeWithoutLanguage(href.slice(PATH_PREFIX.length))));
    for (const [index, language] of LANGUAGES.entries()) {
      assert.deepEqual(routes[index], routes[0], `page ${archiveRoute(language)}: the same projects in the same order as the Spanish archive`);
    }
  });

  it("renders each listed project's title, venue and dates in the page's language", () => {
    for (const language of LANGUAGES) {
      const route = archiveRoute(language);
      const doc = readPage(route);

      for (const project of ARCHIVE_PROJECTS) {
        // The version's own value where it has one, the Spanish value otherwise
        // (ADR-0002: an untranslated field falls back silently), read from the
        // content rather than from the template.
        const version = projectVersion(project.route, language);
        const article = listedArticle(doc, route, version.title);
        const text = normalize(article.textContent);

        const venue = article.querySelectorAll("header > div")[0];
        const dates = article.querySelectorAll("header > div")[1];
        if (version.venue) assert.ok(text.includes(plain(version.venue)), `page ${route}: ${version.title}'s venue "${version.venue}" in ${language.code}`);
        assert.ok(text.includes(plain(version.dates)), `page ${route}: ${version.title}'s dates "${version.dates}" in ${language.code}`);
        assert.ok(!text.includes("undefined"), `page ${route}: ${version.title} contains "undefined"`);
        // The standard layout puts venue and dates in their own header cells.
        if (venue) assert.equal(normalize(venue.textContent), plain(version.venue), `page ${route}: ${version.title}'s venue cell`);
        if (dates) assert.equal(normalize(dates.textContent), plain(version.dates), `page ${route}: ${version.title}'s dates cell`);

        const body = article.querySelector(".project-body");
        assert.ok(body, `page ${route}: no project text for ${version.title}`);
        if (language.code === SPANISH.code || version.ownText) {
          assert.ok(!body.hasAttribute("lang"), `page ${route}: ${version.title}'s text is the page's own language`);
          assert.ok(
            normalize(body.textContent).includes(language.code === SPANISH.code ? project.spanish : version.ownText),
            `page ${route}: ${version.title} reads in ${language.code}`,
          );
        } else {
          assert.ok(normalize(body.textContent).includes(project.spanish), `page ${route}: ${version.title} falls back to its Spanish text`);
          assert.equal(body.getAttribute("lang"), SPANISH.code, `page ${route}: ${version.title}'s fallback text declares Spanish`);
        }
      }
    }
  });

  it("links to the counterpart archive, with a plain anchor", () => {
    for (const language of LANGUAGES) {
      const route = archiveRoute(language);
      const doc = readPage(route);
      const other = LANGUAGES.find((candidate) => candidate.code !== language.code);

      const links = doc.querySelectorAll("header a[hreflang]");
      assert.equal(links.length, 1, `page ${route}: one language link in the header`);
      assert.equal(links[0].getAttribute("href"), localUrl(archiveRoute(other)), `page ${route}: the language link reaches the counterpart archive`);
      assert.equal(links[0].getAttribute("hreflang"), other.code, `page ${route}: the link declares the language it leads to`);
      assert.equal(normalize(links[0].textContent), other.label, `page ${route}: the link names that language in its own language`);
      assert.equal(doc.querySelectorAll("script").length, 0, `page ${route}: the language link needs no script`);
    }
  });

  it("advertises both language versions and a self canonical", () => {
    for (const language of LANGUAGES) {
      const route = archiveRoute(language);
      const doc = readPage(route);
      const other = LANGUAGES.find((candidate) => candidate.code !== language.code);

      assert.deepEqual(
        doc.querySelectorAll('link[rel="alternate"]').map((link) => [link.getAttribute("hreflang"), link.getAttribute("href")]),
        [
          [SPANISH.code, `${SITE_URL}${localUrl(archiveRoute(SPANISH))}`],
          [ENGLISH.code, `${SITE_URL}${localUrl(archiveRoute(ENGLISH))}`],
          ["x-default", `${SITE_URL}${localUrl(archiveRoute(SPANISH))}`],
        ],
        `page ${route}: hreflang for both archives, x-default on the Spanish one`,
      );
      assert.equal(doc.querySelector('meta[property="og:locale"]')?.getAttribute("content"), language.locale, `page ${route}: og:locale`);
      assert.equal(
        doc.querySelector('meta[property="og:locale:alternate"]')?.getAttribute("content"),
        other.locale,
        `page ${route}: the alternate locale`,
      );
      assert.equal(doc.querySelector('link[rel="canonical"]')?.getAttribute("href"), `${SITE_URL}${localUrl(route)}`, `page ${route}: self canonical`);
      assert.equal(
        normalize(doc.querySelector('meta[name="description"]')?.getAttribute("content")),
        settings[language.code].description,
        `page ${route}: the meta description is the page language's own`,
      );
    }
  });

  it("reaches the archive from the header, in the page's own language", () => {
    for (const language of LANGUAGES) {
      const route = homeRoute(language);
      const link = readPage(route).querySelector(`header a[href="${localUrl(archiveRoute(language))}"]`);
      assert.ok(link, `page ${route}: the header links to the archive of the page's language (${archiveRoute(language)})`);
      assert.equal(normalize(link.textContent), settings[language.code].nav.projects.label, `page ${route}: the archive link is labelled in the page's language`);
    }
  });

  for (const language of LANGUAGES) {
    for (const project of ARCHIVE_PROJECTS) {
      it(`links ${project.title} to its ${language.code} project page on ${archiveRoute(language)}`, () => {
        const route = archiveRoute(language);
        const article = listedArticle(readPage(route), route, projectVersion(project.route, language).title);
        assert.equal(
          article.querySelector("a")?.getAttribute("href"),
          localUrl(projectRouteIn(project.route, language)),
          `page ${route}: link to ${project.title}`,
        );
      });
    }
  }

  // No archive project carries a video today, so this is a no-op until one
  // does; it keeps the archive surface covered the moment that changes.
  it("renders every listed gallery video with the control bar its flags call for", () => {
    for (const language of LANGUAGES) {
      const route = archiveRoute(language);
      const doc = readPage(route);
      for (const project of ARCHIVE_PROJECTS.filter(({ videos }) => videos.length)) {
        assertGalleryVideos(listedArticle(doc, route, projectVersion(project.route, language).title), project, route);
      }
    }
  });
});

describe("project pages in both languages", () => {
  for (const language of LANGUAGES) {
    for (const project of PROJECTS) {
      const route = projectRouteIn(project.route, language);
      const label = `page ${route}`;
      const version = () => projectVersion(project.route, language);
      const article = () => projectArticle(route);
      const text = () => normalize(article().textContent);
      const body = () => {
        const blocks = article().querySelectorAll(".project-body");
        assert.equal(blocks.length, 1, `${label}: one project body per page`);
        return blocks[0];
      };

      it(`${route} declares its own language`, () => {
        assert.equal(readPage(route).querySelector("html")?.getAttribute("lang"), language.code, `${label}: <html lang>`);
      });

      it(`${route} renders its title, venue and dates in the page's language`, () => {
        const { title, venue, dates } = version();
        assert.equal(normalize(article().querySelector("h1, h2")?.textContent), title, `${label}: project title heading`);
        assert.equal(
          normalize(readPage(route).querySelector("title")?.textContent),
          `${title} — ${SITE.title}`,
          `${label}: <title>`,
        );
        // Venue and dates may be written in Markdown (one carries bold, one a
        // line break), so compare the rendered text with its markup removed.
        const plain = (value) => normalize(String(value ?? "").replace(/\*/g, ""));
        if (venue) assert.ok(text().includes(plain(venue)), `${label}: venue "${venue}"`);
        assert.ok(text().includes(plain(dates)), `${label}: dates "${dates}"`);
        assert.ok(!text().includes("undefined"), `${label}: page text contains "undefined"`);
      });

      it(`${route} renders one body in the page's language, with no divider`, () => {
        const element = body();
        const rendered = normalize(element.textContent);

        assert.equal(element.querySelectorAll(".project-body__divider").length, 0, `${label}: a project page draws no divider`);
        assert.ok(!/\s\/\/\s/.test(rendered), `${label}: the project text carries no "//" mark`);

        if (language.code === SPANISH.code || !version().ownText) {
          // The Spanish page, and the English page of an untranslated project,
          // render the Spanish text.
          assert.ok(rendered.includes(project.spanish), `${label}: the Spanish text "${project.spanish}"`);
        } else {
          assert.ok(rendered.includes(project.english), `${label}: the English text "${project.english}"`);
        }
      });

      it(`${route} renders its gallery in the page's language`, () => {
        const alts = expectedImageAlt(project.route, language);

        const pictures = article().querySelectorAll("picture");
        assert.equal(pictures.length, project.images, `${label}: gallery images rendered`);
        pictures.forEach((picture, index) => {
          const position = `gallery image ${index + 1}`;
          const img = picture.querySelector("img");
          assert.ok(img, `${label}: ${position} has no <img>`);
          assert.equal(img.getAttribute("alt"), alts[index], `${label}: ${position} alt text`);
          assert.ok(
            (img.getAttribute("src") ?? "").startsWith(`${PATH_PREFIX}/img/`),
            `${label}: ${position} src "${img.getAttribute("src")}" uses the responsive image pipeline`,
          );
          assert.ok(
            (img.getAttribute("srcset") ?? "").includes(`${PATH_PREFIX}/img/`),
            `${label}: ${position} srcset uses the responsive image pipeline`,
          );
        });

        // Source, poster, flags and control bar, the same way on every surface.
        assertGalleryVideos(article(), project, route);
      });
    }
  }
});

describe("a language version never carries the other one's text", () => {
  for (const language of LANGUAGES) {
    const other = LANGUAGES.find((candidate) => candidate.code !== language.code);
    // The text the page must not carry: the other language's own. A Spanish
    // page never shows the English text, and an English page of a translated
    // project never shows the Spanish one (an untranslated project's English
    // page shows the Spanish body, which the fallback tests cover).
    const otherMarker = (project) => (language.code === ENGLISH.code ? null : project.english);
    const ownMarker = (project) => (language.code === ENGLISH.code ? project.english : null);
    const spanishText = (project) =>
      normalize(String(projectData(sourceOf(project.route)).es?.text ?? "").replace(/\*/g, ""));

    it(`keeps the other language's project text out of every ${language.code} project page`, () => {
      for (const project of PROJECTS) {
        const route = projectRouteIn(project.route, language);
        const html = normalize(readText(path.posix.join(route, "index.html")));

        const forbidden = otherMarker(project) ?? (ownMarker(project) ? spanishText(project) : null);
        if (!forbidden) continue;
        assert.ok(!html.includes(forbidden), `page ${route}: the ${other.code} text "${forbidden}" is not rendered`);
      }
    });
  }
});

describe("fallback project text on the English pages", () => {
  const TRANSLATED = PROJECTS.filter((project) => project.english);
  const UNTRANSLATED = PROJECTS.filter((project) => !project.english);

  it("shows an untranslated project's Spanish body marked as Spanish, with no notice", () => {
    assert.ok(UNTRANSLATED.length > 0, "fixture: expected untranslated projects");

    for (const project of UNTRANSLATED) {
      const route = projectRouteIn(project.route, ENGLISH);
      const body = projectArticle(route).querySelector(".project-body");
      assert.ok(body, `page ${route}: no project body rendered`);
      assert.equal(body.getAttribute("lang"), SPANISH.code, `page ${route}: the fallback body block declares Spanish`);
      assert.ok(normalize(body.textContent).includes(project.spanish), `page ${route}: the Spanish body is rendered`);
      assert.doesNotMatch(
        normalize(readPage(route).querySelector("main")?.textContent),
        TRANSLATION_NOTICE,
        `page ${route}: nothing on the page announces a missing translation`,
      );
    }
  });

  it("shows a translated project's own body, claiming no other language", () => {
    assert.equal(TRANSLATED.length, BILINGUAL_PROJECT_COUNT, "fixture: the baseline's translated projects");

    for (const project of TRANSLATED) {
      const route = projectRouteIn(project.route, ENGLISH);
      const body = projectArticle(route).querySelector(".project-body");
      assert.ok(body, `page ${route}: no project body rendered`);
      assert.notEqual(body.getAttribute("lang"), SPANISH.code, `page ${route}: the English body is not marked as Spanish`);
      assert.ok(normalize(body.textContent).includes(project.english), `page ${route}: the English body is rendered`);
      assert.doesNotMatch(
        normalize(readPage(route).querySelector("main")?.textContent),
        TRANSLATION_NOTICE,
        `page ${route}: nothing on the page announces a missing translation`,
      );
    }
  });
});

describe("gallery media items", () => {
  /** The gallery children of a project page, in document order. */
  const galleryNodes = (route) =>
    projectArticle(route)
      .querySelectorAll(".project-gallery")
      .flatMap((gallery) => gallery.childNodes.filter((node) => node.nodeType === NodeType.ELEMENT_NODE));

  for (const project of PROJECTS) {
    const { route, images, videos } = project;
    const label = `page ${route}`;
    const total = images + videos.length;

    it(`${route} renders every media item exactly once`, () => {
      const nodes = galleryNodes(route);
      assert.equal(nodes.length, total, `${label}: gallery items`);
      assert.equal(nodes.filter((node) => node.tagName === "PICTURE").length, images, `${label}: gallery images`);
      assert.equal(nodes.filter((node) => node.tagName === "VIDEO").length, videos.length, `${label}: gallery videos`);

      const sources = nodes
        .filter((node) => node.tagName === "PICTURE")
        .map((picture) => picture.querySelector("img")?.getAttribute("src"));
      assert.equal(new Set(sources).size, images, `${label}: every gallery image is a distinct media item`);
    });

    it(`${route} renders its media items in the editor's order`, () => {
      const nodes = galleryNodes(route);

      // Expected item types from the baseline: images fill every position
      // except the ones the baseline records a video at.
      const expected = Array.from({ length: total }, () => "PICTURE");
      for (const video of videos) expected[video.position] = "VIDEO";

      assert.deepEqual(nodes.map((node) => node.tagName), expected, `${label}: gallery item order`);
      for (const video of videos) {
        assert.equal(
          nodes[video.position].getAttribute("src"),
          localUrl(`/assets/videos/${video.source}`),
          `${label}: video at gallery position ${video.position + 1}`,
        );
      }
    });
  }
});

describe("about page in both languages", () => {
  /** The biography and team copy each language version must render. */
  const copy = {
    [SPANISH.code]: { bio: ABOUT.spanish, team: ABOUT.team.spanish, other: ABOUT.english, otherTeam: ABOUT.team.english },
    [ENGLISH.code]: { bio: ABOUT.english, team: ABOUT.team.english, other: ABOUT.spanish, otherTeam: ABOUT.team.spanish },
  };

  it("serves the Spanish About at its current URL and the English one at its mirrored URL", () => {
    for (const language of LANGUAGES) {
      const route = aboutRoute(language);
      const doc = readPage(route);
      assert.equal(doc.querySelector("html")?.getAttribute("lang"), language.code, `page ${route}: <html lang>`);
    }
    assert.equal(SPANISH.prefix, "", "the Spanish About keeps the current URL");
    assert.equal(ENGLISH.prefix, "/en", "the English About mirrors it under /en");
  });

  for (const language of LANGUAGES) {
    const route = aboutRoute(language);
    const other = LANGUAGES.find((candidate) => candidate.code !== language.code);
    const expected = copy[language.code];

    it(`renders only the ${language.code} biography and team on ${route}`, () => {
      const doc = readPage(route);
      const label = `page ${route}`;
      const text = normalize(doc.querySelector("main")?.textContent);

      assert.ok(text.includes(expected.bio), `${label}: the page's own biography "${expected.bio}"`);
      assert.ok(!text.includes(expected.other), `${label}: not the other language's biography`);

      const team = normalize(doc.querySelector("main .about-team")?.textContent);
      assert.ok(team.length > 0, `${label}: no team section rendered`);
      for (const member of expected.team) {
        assert.ok(team.includes(member), `${label}: the team carries "${member}"`);
      }
      // Names repeat across the two lists; the roles and the
      // former-collaborators heading are what each language writes for itself,
      // and they must not be the other language's.
      for (const member of expected.otherTeam.filter((entry) => !expected.team.includes(entry))) {
        assert.ok(!team.includes(member), `${label}: the team leaves out the other language's "${member}"`);
      }

      // No role reads "Spanish / English" in one string.
      for (const mixed of [
        "Fundadora y Curadora / Founder and Curator",
        "Curadora Asociada / Associate Curator",
        "Asistencia Curatorial / Curatorial Assistant",
        "Colaboradoras anteriores / Former collaborators:",
      ]) {
        assert.ok(!text.includes(mixed), `${label}: no half-and-half role "${mixed}"`);
      }
    });

    it(`heads, titles and describes ${route} in its own language`, () => {
      const doc = readPage(route);
      const label = `page ${route}`;
      const title = language.code === SPANISH.code ? ABOUT.title.spanish : ABOUT.title.english;

      const heading = normalize(doc.querySelector("main h1")?.textContent);
      assert.equal(heading, title, `${label}: the page heading is the page language's own`);
      assert.equal(normalize(doc.querySelector("title")?.textContent), `${title} — ${SITE.title}`, `${label}: <title>`);
      assert.equal(
        normalize(doc.querySelector('meta[name="description"]')?.getAttribute("content")),
        language.code === SPANISH.code ? SITE.description : SITE.englishDescription,
        `${label}: the meta description is the page language's own`,
      );
    });

    it(`links ${route} to its counterpart language version`, () => {
      const doc = readPage(route);
      const label = `page ${route}`;

      const links = doc.querySelectorAll("header a[hreflang]");
      assert.equal(links.length, 1, `${label}: one language link in the header`);
      const link = links[0];
      assert.equal(link.getAttribute("href"), localUrl(aboutRoute(other)), `${label}: the language link points at the counterpart About page`);
      assert.equal(link.getAttribute("hreflang"), other.code, `${label}: the link declares the language it leads to`);
      assert.equal(normalize(link.textContent), other.label, `${label}: the link names the language in its own language`);
    });

    it(`declares the hreflang set and a self canonical on ${route}`, () => {
      const doc = readPage(route);
      const label = `page ${route}`;
      const urls = Object.fromEntries(LANGUAGES.map((candidate) => [candidate.code, `${SITE_URL}${localUrl(aboutRoute(candidate))}`]));

      assert.deepEqual(
        Object.fromEntries(
          doc.querySelectorAll('link[rel="alternate"]').map((link) => [link.getAttribute("hreflang"), link.getAttribute("href")]),
        ),
        {
          [SPANISH.code]: urls[SPANISH.code],
          [ENGLISH.code]: urls[ENGLISH.code],
          "x-default": urls[SPANISH.code],
        },
        `${label}: hreflang links, x-default pointing at the Spanish About page`,
      );
      assert.equal(doc.querySelector('link[rel="canonical"]')?.getAttribute("href"), `${SITE_URL}${localUrl(route)}`, `${label}: self canonical`);
    });
  }

  it("stores each language version in its own object, without the separator", () => {
    const data = projectData("src/acerca-de.md");

    assert.ok(
      String(data.es?.bio ?? "").trim().startsWith(ABOUT.spanish),
      `page ${aboutRoute(SPANISH)}: "es.bio" starts the Spanish biography`,
    );
    assert.ok(
      String(data.en?.bio ?? "").trim().startsWith(ABOUT.english),
      `page ${aboutRoute(ENGLISH)}: "en.bio" starts the English biography`,
    );

    for (const flat of ["bio", "bio_es", "bio_en", "team"]) {
      assert.ok(!Object.hasOwn(data, flat), `acerca-de.md: the flat "${flat}" field is gone`);
    }
    for (const code of [SPANISH.code, ENGLISH.code]) {
      assert.equal(typeof data[code]?.team, "string", `acerca-de.md: "${code}.team" is one rich-text field`);
      assert.equal(typeof data[code]?.title, "string", `acerca-de.md: "${code}.title" is the page title in that language`);
      assert.ok(data[code]?.title?.trim(), `acerca-de.md: "${code}.title" is not blank`);
      assert.equal(
        data[code].title,
        code === SPANISH.code ? ABOUT.title.spanish : ABOUT.title.english,
        `acerca-de.md: "${code}.title" is the page's own`,
      );
    }

    for (const key of ["es.bio", "en.bio", "es.team", "en.team"]) {
      const value = key.split(".").reduce((value, step) => value?.[step], data);
      assert.ok(
        !/^[ \t]*\/\/[ \t]*$/m.test(String(value ?? "")),
        `acerca-de.md: "${key}" contains a literal // separator line`,
      );
    }
  });
});

describe("about page with no English version written (Untranslated field)", () => {
  // Every English value cleared in Pages CMS is a legal state (ADR-0002): the
  // English page shows the Spanish text, silently. The fixture build empties
  // the English version of the real About page and renders it (see
  // test/support/untranslated-about.mjs), so this is asserted on built pages.
  let outputDir;

  before(async () => {
    outputDir = await buildUntranslatedAbout();
  });

  /** The biography and team section of a page, as a visitor reads them. */
  const sections = (doc) => ({
    bio: normalize(doc.querySelector("main .about-bio")?.textContent),
    team: normalize(doc.querySelector("main .about-team")?.textContent),
  });

  for (const [variant, route] of [
    ["no `en` object at all", UNTRANSLATED_ROUTE],
    ["English fields left blank", BLANK_ROUTE],
  ]) {
    it(`builds the English page with ${variant} and shows the Spanish text`, () => {
      const spanish = sections(readOutputPage(outputDir, route));
      const englishDoc = readOutputPage(outputDir, `${ENGLISH.prefix}${route}`);
      const label = `page ${ENGLISH.prefix}${route}`;
      const english = sections(englishDoc);

      assert.equal(englishDoc.querySelector("html")?.getAttribute("lang"), ENGLISH.code, `${label}: <html lang>`);
      assert.equal(english.bio, spanish.bio, `${label}: the biography is the Spanish one, with nothing added or announced`);
      assert.equal(english.team, spanish.team, `${label}: the team is the Spanish one, with nothing added or announced`);
      assert.ok(english.bio.length > 0, `${label}: the biography is not empty`);
      assert.ok(english.team.length > 0, `${label}: the team is not empty`);
    });
  }

  it("falls back on the page title until the English one is written", () => {
    const title = (route) => normalize(readOutputPage(outputDir, route).querySelector("title")?.textContent);
    const heading = (route) => normalize(readOutputPage(outputDir, route).querySelector("main h1")?.textContent);

    assert.equal(heading(`${ENGLISH.prefix}${UNTRANSLATED_ROUTE}`), ABOUT.title.spanish, "page /en/acerca-de/: the heading is the Spanish title");
    assert.equal(title(`${ENGLISH.prefix}${UNTRANSLATED_ROUTE}`), `${ABOUT.title.spanish} — ${SITE.title}`, "page /en/acerca-de/: <title>");
    assert.equal(heading(UNTRANSLATED_ROUTE), ABOUT.title.spanish, `page ${UNTRANSLATED_ROUTE}: the Spanish page keeps its own title`);
  });

  it("resolves each field on its own, so a written English title stays English", () => {
    const route = `${ENGLISH.prefix}${BLANK_ROUTE}`;
    const doc = readOutputPage(outputDir, route);

    assert.equal(normalize(doc.querySelector("main h1")?.textContent), ABOUT.title.english, `page ${route}: the English title was written, so it is the heading`);
    assert.equal(normalize(doc.querySelector("title")?.textContent), `${ABOUT.title.english} — ${SITE.title}`, `page ${route}: <title>`);
    assert.ok(!sections(doc).bio.includes(ABOUT.english), `page ${route}: the blank English biography does not reach the page`);
  });

  it("keeps the Spanish page exactly as the fully translated build renders it", () => {
    const spanish = sections(readPage(aboutRoute(SPANISH)));
    const fixture = sections(readOutputPage(outputDir, UNTRANSLATED_ROUTE));

    assert.deepEqual(fixture, spanish, `page ${UNTRANSLATED_ROUTE}: the Spanish page is untouched by the missing English version`);
  });
});

describe("site settings in the generated pages", () => {
  const settings = JSON.parse(readRepoFile("src/_data/site.json"));

  it("keeps the header and footer copy on the pages as the settings write it, per language", () => {
    for (const language of LANGUAGES) {
      const doc = readPage(homeRoute(language));
      const label = `page ${homeRoute(language)}`;
      const text = (selector) => normalize(doc.querySelector(selector)?.textContent);
      // Each language version of a page renders its own language's chrome.
      const chrome = settings[language.code];

      assert.equal(
        text(`header a[href="${localUrl(`${language.prefix}${ABOUT_ROUTE}`)}"]`),
        chrome.nav.about.label,
        `${label}: header About label and target`,
      );
      assert.equal(
        text(`header a[href="${localUrl(`${language.prefix}/proyectos/`)}"]`),
        chrome.nav.projects.label,
        `${label}: header archive label and target`,
      );
      assert.equal(text(`header a[href="mailto:${settings.contactEmail}"]`), settings.contactName, `${label}: contact link`);
      assert.equal(text("header .site-nav__email"), settings.email, `${label}: the e-mail shown as text`);

      const footer = normalize(doc.querySelector(".site-footer")?.textContent);
      for (const value of [chrome.footer.copyright, chrome.footer.city, chrome.footer.instagram]) {
        assert.ok(footer.includes(value), `${label}: footer shows "${value}"`);
      }
    }
  });

  it("stores a route key for each header link, not a literal URL", () => {
    for (const language of ["es", "en"]) {
      const nav = settings[language]?.nav ?? {};
      assert.deepEqual(Object.keys(nav).sort(), ["about", "projects"], `settings.${language}.nav: linked pages`);

      for (const [name, link] of Object.entries(nav)) {
        assert.equal(link.route, name, `settings.${language}.nav.${name}: the route key names the page the layout builds the URL from`);
        assert.ok(!Object.hasOwn(link, "url"), `settings.${language}.nav.${name}: stores no literal URL`);
        assert.ok(typeof link.label === "string" && link.label.trim(), `settings.${language}.nav.${name}: has a label`);
      }
    }
  });

  it("titles every page and describes each homepage from its own language", () => {
    for (const language of LANGUAGES) {
      const doc = readPage(homeRoute(language));
      const label = `page ${homeRoute(language)}`;

      assert.equal(normalize(doc.querySelector('meta[property="og:site_name"]')?.getAttribute("content")), settings.title, `${label}: og:site_name`);
      assert.equal(doc.querySelector("title")?.textContent, settings.title, `${label}: the title is the site name`);
      assert.equal(
        normalize(doc.querySelector('meta[name="description"]')?.getAttribute("content")),
        settings[language.code].description,
        `${label}: the meta description is the page language's own`,
      );
    }

    assert.ok(
      readPage(ABOUT_ROUTE).querySelector("title")?.textContent.endsWith(`— ${settings.title}`),
      `page ${ABOUT_ROUTE}: the site name follows the page title`,
    );
  });

  it("leaves the informational settings out of the pages", () => {
    // `social.instagram` is the one informational value that no rendered page
    // repeats or derives from another setting, so its absence is checkable.
    // (`url` is what the deploy sets as SITE_URL, and `instagram` / `city`
    // repeat the footer values; the canonical assertions elsewhere pin the
    // origin to SITE_URL, which is what proves `url` is never read.)
    const pages = ["/", ...LANGUAGES.map(aboutRoute), "/proyectos/"].map((page) => readText(path.posix.join(page, "index.html")));
    for (const html of pages) {
      assert.ok(!html.includes(settings.social.instagram), "no page renders the social.instagram reference URL");
    }
  });
});

describe("page metadata", () => {
  const pages = [
    ...LANGUAGES.map((language) => [homeRoute(language), language.code === SPANISH.code ? SITE.description : SITE.englishDescription]),
    ...LANGUAGES.flatMap((language) => PROJECTS.map((project) => [projectRouteIn(project.route, language), null])),
    ...LANGUAGES.map((language) => [aboutRoute(language), language.code === SPANISH.code ? SITE.description : SITE.englishDescription]),
  ];

  for (const [route, expectedDescription] of pages) {
    it(`${route} has a description and social image`, () => {
      const doc = readPage(route);
      const label = `page ${route}`;

      const description = normalize(doc.querySelector('meta[name="description"]')?.getAttribute("content"));
      assert.ok(description.length > 0, `${label}: meta description is empty`);
      if (expectedDescription) {
        assert.equal(description, expectedDescription, `${label}: meta description`);
      }

      const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute("href");
      assert.equal(canonical, `${SITE_URL}${localUrl(route)}`, `${label}: canonical URL`);

      const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute("content");
      assert.ok(ogImage?.startsWith(`${SITE_URL}${PATH_PREFIX}/`), `${label}: og:image "${ogImage}" is an absolute site URL`);

      const twitterImage = doc.querySelector('meta[name="twitter:image"]')?.getAttribute("content");
      assert.equal(twitterImage, ogImage, `${label}: twitter:image matches og:image`);
    });
  }

  it("describes each project page with the start of its own language's text", () => {
    for (const language of LANGUAGES) {
      for (const project of PROJECTS) {
        const route = projectRouteIn(project.route, language);
        const description = normalize(readPage(route).querySelector('meta[name="description"]')?.getAttribute("content"));
        assert.ok(description.length > 0, `page ${route}: meta description is empty`);

        // The description is the page's own text, rendered with its tags
        // stripped and truncated, so comparing against the raw field only needs
        // the emphasis markers removed and the truncation mark ignored.
        const source = projectVersion(project.route, language).text;
        const plain = normalize(String(source ?? "").replace(/\*/g, ""));
        assert.ok(
          plain.startsWith(description.replace(/(\.{3}|…)$/, "")),
          `page ${route}: meta description "${description}" starts the text of its own language version`,
        );
      }
    }
  });

  it("describes a translated project's English page from its English text, never the Spanish one", () => {
    const translated = PROJECTS.filter((project) => project.english);
    assert.ok(translated.length > 0, "fixture: expected translated projects");

    for (const project of translated) {
      const route = projectRouteIn(project.route, ENGLISH);
      const description = normalize(readPage(route).querySelector('meta[name="description"]')?.getAttribute("content"));
      const spanish = normalize(String(projectData(sourceOf(project.route)).es?.text ?? "").replace(/\*/g, ""));

      assert.ok(description.includes(project.english), `page ${route}: the description comes from the English text`);
      assert.ok(!spanish.startsWith(description.replace(/(\.{3}|…)$/, "")), `page ${route}: the description is not the Spanish text`);
    }
  });
});

/**
 * The three surfaces (project page, homepage, archive page) share one rendering
 * path. These assertions pin the per-surface differences that path centralizes:
 * heading level, linked titles, gallery columns, and first-image priority.
 */
describe("project rendering contract", () => {
  // Both homepages and both archives render the same listings.
  const LISTING_ROUTES = [...LANGUAGES.map(homeRoute), ...LANGUAGES.map(archiveRoute)];

  it("gives project pages an h1 title and listing pages an h2 title", () => {
    for (const { route } of PROJECTS) {
      const heading = projectArticle(route).querySelector("h1, h2");
      assert.equal(heading?.tagName, "H1", `page ${route}: project title heading level`);
    }

    for (const route of LISTING_ROUTES) {
      const headings = readPage(route)
        .querySelectorAll("main article")
        .map((article) => article.querySelector("h1, h2")?.tagName);
      assert.ok(headings.length > 0, `page ${route}: no project headings rendered`);
      assert.deepEqual(
        headings.filter((tagName) => tagName !== "H2"),
        [],
        `page ${route}: listing project titles are section headings`,
      );
    }
  });

  it("links archive titles to their project pages and leaves homepage titles unlinked", () => {
    for (const { route } of PROJECTS) {
      assert.equal(projectArticle(route).querySelector("h1 a, h2 a"), null, `page ${route}: project page title is not a link`);
    }

    const homepageTitles = readPage("/")
      .querySelectorAll("main article")
      .map((article) => article.querySelector("h1 a, h2 a")?.getAttribute("href"))
      .filter(Boolean);
    assert.deepEqual(homepageTitles, [], "page /: homepage titles do not link to their project pages");

    const archiveRoutes = readPage("/proyectos/")
      .querySelectorAll("main article")
      .map((article) => article.querySelector("h1, h2 a")?.getAttribute("href"));
    assert.deepEqual(
      archiveRoutes,
      ARCHIVE_PROJECTS.map((project) => localUrl(project.route)),
      "page /proyectos/: every archive title links to its project page",
    );
  });

  it("renders a standard gallery with its column count", () => {
    for (const { route } of PROJECTS) {
      if (route === THREE_COLUMN_ROUTE) continue;
      const galleries = projectArticle(route).querySelectorAll(".project-gallery");
      assert.equal(galleries.length, 1, `page ${route}: standard projects have one gallery`);
      assert.equal(
        galleries[0].getAttribute("data-columns"),
        TWO_COLUMN_PROJECTS.some((project) => project.route === route) ? "2" : "1",
        `page ${route}: gallery column count`,
      );
    }
  });

  it("splits the three-column gallery in half, rounding up, without losing media", () => {
    const article = projectArticle(THREE_COLUMN_ROUTE);
    const galleries = article.querySelectorAll(".project-gallery");
    assert.equal(galleries.length, 2, `page ${THREE_COLUMN_ROUTE}: three-column layout has two galleries`);
    for (const gallery of galleries) {
      assert.equal(gallery.hasAttribute("data-columns"), false, `page ${THREE_COLUMN_ROUTE}: three-column galleries take no column count`);
    }

    // One ordered gallery, split for the layout: the first column takes the
    // first half of the media items rounded up, the second column the rest.
    const total = THREE_COLUMN_PROJECT.gallery.length;
    const columns = galleries.map((gallery) => gallery.querySelectorAll("picture").length);
    assert.deepEqual(columns, [Math.ceil(total / 2), Math.floor(total / 2)], `page ${THREE_COLUMN_ROUTE}: media items per column`);

    const sources = galleries.flatMap((gallery) =>
      gallery.querySelectorAll("picture img").map((img) => img.getAttribute("src")),
    );
    assert.equal(sources.length, total, `page ${THREE_COLUMN_ROUTE}: media items across both galleries`);
    assert.equal(new Set(sources).size, total, `page ${THREE_COLUMN_ROUTE}: every gallery item appears exactly once`);
  });

  it("leads the three-column second column with the gallery's cover image", () => {
    // The page's cover image is the media item that heads the second column.
    // Reading it off the preload/og:image URL identifies that item independently
    // of the templates: the pipeline names one file per media item.
    const doc = readPage(THREE_COLUMN_ROUTE);
    const cover = new URL(doc.querySelector('meta[property="og:image"]')?.getAttribute("content")).pathname;
    const [first, second] = projectArticle(THREE_COLUMN_ROUTE).querySelectorAll(".project-gallery");

    const srcsetOf = (gallery, position) => gallery.querySelectorAll("picture")[position]?.querySelector("img")?.getAttribute("srcset");
    assert.ok(srcsetOf(second, 0)?.includes(cover), `page ${THREE_COLUMN_ROUTE}: the second column starts at the cover image`);
    assert.ok(!srcsetOf(first, 0)?.includes(cover), `page ${THREE_COLUMN_ROUTE}: the first column does not start at the cover image`);

    // The preload names the same media item in AVIF, so compare the file stem.
    const stem = path.posix.basename(cover, path.posix.extname(cover));
    assert.ok(
      doc.querySelector('link[rel="preload"][as="image"]')?.getAttribute("imagesrcset")?.includes(stem),
      `page ${THREE_COLUMN_ROUTE}: the preload matches the cover image`,
    );
  });

  it("loads only one gallery image eagerly per page", () => {
    const eager = (route) => projectArticle(route).querySelectorAll('img[loading="eager"]');

    // A project page prioritizes its own first gallery image.
    const projectPage = PROJECTS[0].route;
    assert.equal(eager(projectPage).length, 1, `page ${projectPage}: one eager image`);

    // A listing page prioritizes the first gallery image of its first project only.
    for (const route of LISTING_ROUTES) {
      const articles = readPage(route).querySelectorAll("main article");
      assert.equal(eager(route).length, 1, `page ${route}: one eager image`);
      assert.equal(
        articles[0].querySelectorAll('img[loading="eager"]').length,
        1,
        `page ${route}: the eager image belongs to the first listed project`,
      );
    }

    // The legacy three-column layout never prioritizes an image.
    assert.equal(eager(THREE_COLUMN_ROUTE).length, 0, `page ${THREE_COLUMN_ROUTE}: no eager image`);
  });
});

/**
 * Every page that renders project text, and so can carry its links: both
 * homepages, both archives and both language versions of every project.
 */
const PAGES_WITH_PROJECT_TEXT = [
  ...LANGUAGES.map((language) => `${language.prefix}/`),
  ...LANGUAGES.flatMap((language) => PROJECTS.map((project) => projectRouteIn(project.route, language))),
  ...LANGUAGES.map(archiveRoute),
];

/** Links rendered inside the project text of a page, in document order. */
function bodyLinks(pageRoute) {
  return readPage(pageRoute)
    .querySelectorAll("main .project-body")
    .flatMap((body) => body.querySelectorAll("a"));
}

/** A URL the site itself owns: root-relative, no scheme, no host. */
const isLocalRootRelative = (href) => href.startsWith("/") && !href.startsWith("//");

describe("local document links", () => {
  it("links each local document from the language version that links it, under the deployment path prefix", () => {
    for (const document of LOCAL_DOCUMENTS) {
      for (const language of LANGUAGES) {
        const pageRoute = projectRouteIn(document.route, language);
        // A translated project's English page carries its English text, so the
        // document is linked from the page whose own text links it, and absent
        // from the page whose text does not.
        if (!projectVersion(document.route, language).text.includes(`/assets/files/${document.file}`)) {
          assert.deepEqual(
            bodyLinks(pageRoute).filter((link) => normalize(link.textContent) === document.label),
            [],
            `page ${pageRoute}: no “${document.label}” link, since this language's text links no document`,
          );
          continue;
        }

        const links = bodyLinks(pageRoute).filter((link) => normalize(link.textContent) === document.label);
        assert.equal(links.length, 1, `page ${pageRoute}: exactly one “${document.label}” link`);
        assert.equal(
          links[0].getAttribute("href"),
          localUrl(`/assets/files/${document.file}`),
          `page ${pageRoute}: the “${document.label}” link points at the document under the path prefix`,
        );
      }
    }
  });

  it("offers every document a language version links from that language's page", () => {
    for (const language of LANGUAGES) {
      for (const project of PROJECTS) {
        const pageRoute = projectRouteIn(project.route, language);
        const source = projectVersion(project.route, language).text;
        const documents = [...source.matchAll(/\]\((\/assets\/files\/[^)\s]+)\)/g)].map((match) => match[1]);

        for (const document of documents) {
          const hrefs = bodyLinks(pageRoute).map((link) => link.getAttribute("href"));
          assert.ok(
            hrefs.includes(localUrl(document)),
            `page ${pageRoute}: the document ${document} linked from this language's text is reachable on this page`,
          );
        }
      }
    }
  });

  it("points every local link in project text at a file in the generated site", () => {
    for (const pageRoute of PAGES_WITH_PROJECT_TEXT) {
      for (const link of bodyLinks(pageRoute)) {
        const href = link.getAttribute("href");
        if (!isLocalRootRelative(href)) continue; // external or scheme link: checked below
        assert.ok(href.startsWith(`${PATH_PREFIX}/`), `page ${pageRoute}: local link ${href} carries the path prefix`);
        const file = path.join(OUTPUT_DIR, href.slice(PATH_PREFIX.length));
        assert.ok(
          fs.existsSync(file),
          `page ${pageRoute}: local link ${href} resolves to generated file ${path.relative(OUTPUT_DIR, file)}`,
        );
      }
    }
  });

  it("leaves external links exactly as the content wrote them", () => {
    for (const language of LANGUAGES) {
      for (const project of PROJECTS) {
        const pageRoute = projectRouteIn(project.route, language);
        const external = [...projectVersion(project.route, language).text.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map(
          (match) => match[1],
        );
        if (!external.length) continue;

        const rendered = bodyLinks(pageRoute)
          .map((link) => link.getAttribute("href"))
          .filter((href) => /^https?:\/\//.test(href));
        assert.deepEqual(rendered, external, `page ${pageRoute}: external links are untouched`);
      }
    }
  });

  it("repairs the malformed link wrappers into single links", () => {
    for (const language of LANGUAGES) {
      for (const { route, label, file } of LOCAL_DOCUMENTS) {
        const pageRoute = projectRouteIn(route, language);
        if (!projectVersion(route, language).text.includes(`/assets/files/${file}`)) continue;
        const blocks = projectBodyBlocks(pageRoute).filter((block) => block.text.includes(label));
        assert.equal(blocks.length, 1, `page ${pageRoute}: “${label}” renders as one block`);

        const { element, text } = blocks[0];
        const anchors = element.querySelectorAll("a");
        assert.equal(anchors.length, 1, `page ${pageRoute}: “${label}” is a single link, not split text`);
        assert.equal(text, label, `page ${pageRoute}: the “${label}” block carries only the link text`);
        assert.ok(!/\]\(/.test(text), `page ${pageRoute}: no raw Markdown link residue around “${label}”`);
      }
    }
  });

  it("never applies the path prefix twice", () => {
    if (!PATH_PREFIX) return; // a root build has no prefix to duplicate
    const doubled = `${PATH_PREFIX}${PATH_PREFIX}/`;
    for (const pageRoute of PAGES_WITH_PROJECT_TEXT) {
      for (const href of bodyLinks(pageRoute).map((link) => link.getAttribute("href"))) {
        assert.ok(!href.startsWith(doubled), `page ${pageRoute}: ${href} is not double-prefixed`);
      }
    }
  });
});

/**
 * The repository's English texts link no local document yet, so the English
 * page is exercised on a throwaway project: one whose Spanish text links a
 * document and whose English text links that same file plus one of its own —
 * an editor may write different documents per language. Each language page
 * must reach the documents its own language's text links, and only those.
 */
describe("a project whose language versions each link a document", () => {
  const SLUG = "fixture-en-document";
  const DOCUMENT = "/assets/files/PPD_LAVA_posterzine.pdf";
  const ENGLISH_ONLY = "/assets/files/Dossier_Tiempos-Pendulares-x-Lava.pdf";
  let output;

  before(async () => {
    const inputDir = writeContentDir(
      {
        [`${SLUG}.md`]: projectFile(`
es:
  title: Fixture con documento
  text: |-
    Texto en español con su [Dossier](${DOCUMENT}).
en:
  title: Fixture with a document
  text: |-
    English text with its [Dossier](${DOCUMENT}) and [English-only](${ENGLISH_ONLY}).
media:
  - type: image
    src: "/assets/images/lava-logo.png"
`),
      },
      {
        // The site settings the layouts read and the languages the build
        // paginates over (a throwaway input directory carries no `_data/`).
        data: {
          "languages.json": readRepoFile("src/_data/languages.json"),
          "site.json": readRepoFile("src/_data/site.json"),
        },
      },
    );
    output = await buildContentDir(inputDir, { render: true });
  });

  for (const language of LANGUAGES) {
    const route = `${language.prefix}/proyectos/${SLUG}/`;

    it(`${route} reaches the documents its own language's text links, and only those`, () => {
      const links = readOutputPage(output, route)
        .querySelectorAll("main .project-body a")
        .map((link) => link.getAttribute("href"));

      assert.ok(links.includes(DOCUMENT), `page ${route}: the document this language's text links`);
      assert.equal(
        links.includes(ENGLISH_ONLY),
        language.code === ENGLISH.code,
        `page ${route}: a document only the English text links stays with the English page`,
      );
    });
  }
});

describe(`subpath deployment (${SUBPATH_PREFIX})`, () => {
  const PREFIX = SUBPATH_PREFIX.replace(/\/$/, "");
  let output;

  before(async () => {
    output = await buildPrefixedSite();
  });

  const page = (route) => readOutputPage(output, route);

  /** Every URL the page owns: its root-relative `href` / `src` values. */
  const localUrls = (doc) =>
    doc
      .querySelectorAll("[href], [src]")
      .flatMap((node) => ["href", "src"].map((name) => node.getAttribute(name)))
      .filter((url) => url?.startsWith("/") && !url.startsWith("//"));

  it("prefixes every URL the site owns, exactly once", () => {
    for (const route of [
      ...LANGUAGES.map(homeRoute),
      ...LANGUAGES.map(aboutRoute),
      ...LANGUAGES.map(archiveRoute),
      ...LANGUAGES.map((language) => projectRouteIn(PROJECTS[0].route, language)),
      THREE_COLUMN_ROUTE,
    ]) {
      const urls = localUrls(page(route));
      assert.ok(urls.length > 0, `page ${route}: no local URLs rendered`);
      for (const url of urls) {
        assert.ok(url.startsWith(`${PREFIX}/`), `page ${route}: ${url} carries the path prefix`);
        assert.ok(!url.startsWith(`${PREFIX}${PREFIX}/`), `page ${route}: ${url} is prefixed exactly once`);
      }
    }
  });

  it("serves both language versions of the About page under the prefix", () => {
    const english = page(aboutRoute(ENGLISH));
    assert.equal(english.querySelector("html")?.getAttribute("lang"), ENGLISH.code, `page ${aboutRoute(ENGLISH)}: page language under the subpath`);
    assert.ok(
      normalize(english.querySelector("main .about-bio")?.textContent).includes(ABOUT.english),
      `page ${aboutRoute(ENGLISH)}: the English biography under the subpath`,
    );

    const backToSpanish = english.querySelector("header a[hreflang]");
    assert.equal(
      backToSpanish?.getAttribute("href"),
      `${PREFIX}${aboutRoute(SPANISH)}`,
      `page ${aboutRoute(ENGLISH)}: the language link points at the prefixed Spanish About page`,
    );
    assert.equal(normalize(backToSpanish?.textContent), SPANISH.label, `page ${aboutRoute(ENGLISH)}: the language link names Español`);

    for (const language of LANGUAGES) {
      assert.deepEqual(
        page(aboutRoute(language))
          .querySelectorAll('link[rel="alternate"]')
          .map((node) => node.getAttribute("href")),
        [
          `${SITE_URL}${PREFIX}${aboutRoute(SPANISH)}`,
          `${SITE_URL}${PREFIX}${aboutRoute(ENGLISH)}`,
          `${SITE_URL}${PREFIX}${aboutRoute(SPANISH)}`,
        ],
        `page ${aboutRoute(language)}: hreflang links carry the path prefix`,
      );
    }
  });

  it("serves both language versions of the homepage under the prefix", () => {
    const english = page(homeRoute(ENGLISH));
    assert.equal(english.querySelector("html")?.getAttribute("lang"), ENGLISH.code, `page ${homeRoute(ENGLISH)}: page language under the subpath`);

    const backToSpanish = english.querySelector("header a[hreflang]");
    assert.equal(backToSpanish?.getAttribute("href"), `${PREFIX}${homeRoute(SPANISH)}`, `page ${homeRoute(ENGLISH)}: the language link points at the prefixed Spanish homepage`);
    assert.equal(normalize(backToSpanish?.textContent), SPANISH.label, `page ${homeRoute(ENGLISH)}: the language link names Español`);

    const toEnglish = page(homeRoute(SPANISH)).querySelector("header a[hreflang]");
    assert.equal(toEnglish?.getAttribute("href"), `${PREFIX}${homeRoute(ENGLISH)}`, `page ${homeRoute(SPANISH)}: the language link points at the prefixed English homepage`);

    for (const language of LANGUAGES) {
      assert.deepEqual(
        page(homeRoute(language))
          .querySelectorAll('link[rel="alternate"]')
          .map((node) => node.getAttribute("href")),
        [
          `${SITE_URL}${PREFIX}${homeRoute(SPANISH)}`,
          `${SITE_URL}${PREFIX}${homeRoute(ENGLISH)}`,
          `${SITE_URL}${PREFIX}${homeRoute(SPANISH)}`,
        ],
        `page ${homeRoute(language)}: hreflang links carry the path prefix`,
      );
    }
  });

  it("serves both language versions of the archive under the prefix", () => {
    const english = page(archiveRoute(ENGLISH));
    const settings = JSON.parse(readRepoFile("src/_data/site.json"));

    assert.equal(english.querySelector("html")?.getAttribute("lang"), ENGLISH.code, `page ${archiveRoute(ENGLISH)}: page language under the subpath`);
    assert.equal(
      normalize(english.querySelector("main h1")?.textContent),
      settings[ENGLISH.code].archiveHeading,
      `page ${archiveRoute(ENGLISH)}: the English heading under the subpath`,
    );
    assert.equal(
      english.querySelector('link[rel="canonical"]')?.getAttribute("href"),
      `${SITE_URL}${PREFIX}${archiveRoute(ENGLISH)}`,
      `page ${archiveRoute(ENGLISH)}: canonical under the prefixed route`,
    );

    for (const language of LANGUAGES) {
      const doc = page(archiveRoute(language));
      const counterpart = language.code === SPANISH.code ? ENGLISH : SPANISH;

      assert.equal(
        doc.querySelector("header a[hreflang]")?.getAttribute("href"),
        `${PREFIX}${archiveRoute(counterpart)}`,
        `page ${archiveRoute(language)}: the language link points at the prefixed counterpart archive`,
      );
      assert.deepEqual(
        doc.querySelectorAll('link[rel="alternate"]').map((node) => node.getAttribute("href")),
        [
          `${SITE_URL}${PREFIX}${archiveRoute(SPANISH)}`,
          `${SITE_URL}${PREFIX}${archiveRoute(ENGLISH)}`,
          `${SITE_URL}${PREFIX}${archiveRoute(SPANISH)}`,
        ],
        `page ${archiveRoute(language)}: hreflang links carry the path prefix`,
      );
    }

    const listed = [...readOutputText(output, "/sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    for (const language of LANGUAGES) {
      assert.ok(
        listed.includes(`${SITE_URL}${PREFIX}${archiveRoute(language)}`),
        `page /sitemap.xml: ${archiveRoute(language)} is listed under the prefix`,
      );
    }
  });

  it("serves a project page in its own language under the prefix", () => {
    // A translated project, so the English page renders its own body, not a fallback.
    const project = PROJECTS.find((candidate) => candidate.english);
    assert.ok(project, "fixture: expected a project with English text");

    for (const language of LANGUAGES) {
      const route = projectRouteIn(project.route, language);
      const doc = page(route);
      const version = projectVersion(project.route, language);
      const body = normalize(doc.querySelector("main .project-body")?.textContent);
      const expected = language.code === ENGLISH.code && version.ownText ? project.english : project.spanish;

      assert.equal(doc.querySelector("html")?.getAttribute("lang"), language.code, `page ${route}: page language under the subpath`);
      assert.ok(body.includes(expected), `page ${route}: the body of this language version under the subpath`);

      const counterpart = language.code === SPANISH.code ? ENGLISH : SPANISH;
      const link = doc.querySelector("header a[hreflang]");
      assert.equal(
        link?.getAttribute("href"),
        `${PREFIX}${projectRouteIn(project.route, counterpart)}`,
        `page ${route}: the language link points at the prefixed counterpart project page`,
      );

      assert.deepEqual(
        doc.querySelectorAll('link[rel="alternate"]').map((node) => node.getAttribute("href")),
        [
          `${SITE_URL}${PREFIX}${projectRouteIn(project.route, SPANISH)}`,
          `${SITE_URL}${PREFIX}${projectRouteIn(project.route, ENGLISH)}`,
          `${SITE_URL}${PREFIX}${projectRouteIn(project.route, SPANISH)}`,
        ],
        `page ${route}: hreflang links carry the path prefix`,
      );
    }
  });

  it("lists both homepages in the prefixed sitemap with prefixed alternates", () => {
    const xml = readOutputText(output, "/sitemap.xml");

    for (const language of LANGUAGES) {
      assert.ok(
        xml.includes(`<loc>${SITE_URL}${PREFIX}${homeRoute(language)}</loc>`),
        `page /sitemap.xml: ${homeRoute(language)} is listed under the prefix`,
      );
    }

    const alternates = [...xml.matchAll(/<xhtml:link rel="alternate" hreflang="[^"]+" href="([^"]+)"/g)].map((match) => match[1]);
    assert.ok(alternates.length > 0, "page /sitemap.xml: no alternates under the prefix");
    for (const href of alternates) {
      assert.ok(href.startsWith(`${SITE_URL}${PREFIX}/`), `page /sitemap.xml: alternate ${href} carries the path prefix`);
    }
  });

  it("keeps canonical URLs and the sitemap on the prefixed routes", () => {
    const route = PROJECTS[0].route;
    assert.equal(
      page(route).querySelector('link[rel="canonical"]')?.getAttribute("href"),
      `${SITE_URL}${PREFIX}${route}`,
      `page ${route}: canonical URL under the subpath`,
    );

    const listed = [...readOutputText(output, "/sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    assert.ok(listed.length > 0, "page /sitemap.xml: no URLs listed");
    for (const loc of listed) {
      assert.ok(loc.startsWith(`${SITE_URL}${PREFIX}/`), `page /sitemap.xml: ${loc} carries the path prefix`);
    }
  });

  it("serves the gallery video and the dossier links under the prefix", () => {
    const project = PROJECTS.find(({ videos }) => videos.length);
    assert.ok(project, "fixture: expected a project with a video");
    const video = page(project.route).querySelector("video");
    assert.equal(
      video?.getAttribute("src"),
      `${PREFIX}/assets/videos/${project.videos[0].source}`,
      `page ${project.route}: video source under the subpath`,
    );
    // The control bar travels with the markup, so the subpath build must not
    // lose it: the same expectation, derived from this video's own flags.
    assert.equal(
      video?.hasAttribute("controls"),
      keepsControls(project.videos[0]),
      `page ${project.route}: gallery video 1 controls under the subpath`,
    );
    assert.equal(video?.hasAttribute("playsinline"), true, `page ${project.route}: gallery video 1 playsinline under the subpath`);
    assert.equal(video?.getAttribute("preload"), "metadata", `page ${project.route}: gallery video 1 preload under the subpath`);

    const { route, file } = LOCAL_DOCUMENTS[0];
    const hrefs = page(route)
      .querySelectorAll("main .project-body a")
      .map((link) => link.getAttribute("href"));
    assert.ok(hrefs.includes(`${PREFIX}/assets/files/${file}`), `page ${route}: dossier link ${file} under the subpath`);
  });

  it("serves the responsive images and social metadata under the prefix", () => {
    const route = PROJECTS[0].route;
    const doc = page(route);

    assert.ok(
      doc.querySelector("main .project-gallery img")?.getAttribute("src")?.startsWith(`${PREFIX}/img/`),
      `page ${route}: gallery images come from the prefixed image pipeline`,
    );
    assert.ok(
      doc.querySelector('meta[property="og:image"]')?.getAttribute("content")?.startsWith(`${SITE_URL}${PREFIX}/img/`),
      `page ${route}: og:image is an absolute prefixed URL`,
    );
  });
});
