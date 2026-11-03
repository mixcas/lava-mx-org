import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { before, describe, it } from "node:test";

import yaml from "js-yaml";
import { NodeType } from "node-html-parser";

import { LEGACY_KEYS } from "../lib/project-contract.js";
import { ASSET_FOLDER, ASSET_URL, FORMATS, GALLERY_TYPES } from "../lib/media-assets.js";
import { projectData, projectFiles, projectRoute } from "./support/content.mjs";
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

/**
 * The alt text each gallery image must render, read from the content: the
 * item's own alt text when it has one, otherwise the project title.
 */
function expectedImageAlt(route) {
  const data = projectData(sourceOf(route));
  return (Array.isArray(data.media) ? data.media : [])
    .filter((item) => item.type !== "video")
    .map((item) => (typeof item.alt === "string" ? item.alt.trim() : "") || data.title);
}

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
});

describe("project content model", () => {
  /** Directory-level defaults shared by every project entry (Eleventy directory data file). */
  const DEFAULTS_FILE = "src/proyectos/proyectos.11tydata.json";

  it("supplies layout, variant, homepage status, order and columns from directory defaults", () => {
    const defaults = JSON.parse(readRepoFile(DEFAULTS_FILE));

    assert.deepEqual(
      defaults,
      { layout: "project", variant: "standard", featured: false, order: 0, gallery_columns: 1 },
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
  const ITEM_KEYS = { image: ["type", "src", "alt"], video: ["type", "src", "poster", "autoplay", "loop", "mute"] };
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

  it("stores each language in its own text field", () => {
    for (const file of projectFiles()) {
      const data = projectData(file);
      const spanish = typeof data.text_es === "string" ? data.text_es.trim() : "";
      assert.ok(spanish.length > 0, `${file}: "text_es" is the Spanish text and is never empty`);
      assert.ok(!Object.hasOwn(data, "text"), `${file}: the legacy "text" field is gone`);

      const baseline = PROJECTS.find((project) => project.route === projectRoute(file));
      assert.ok(baseline, `${file}: no baseline project for this content file`);
      if (baseline.english) {
        assert.ok(
          typeof data.text_en === "string" && data.text_en.trim().length > 0,
          `${file}: bilingual projects carry the English text in "text_en"`,
        );
      }
    }
  });

  it("keeps no literal // separator in project text", () => {
    for (const file of projectFiles()) {
      const data = projectData(file);
      for (const key of ["text", "text_es", "text_en"]) {
        const value = data[key];
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

  it("shows the filename on create and edit, seeded from the title", () => {
    assert.deepEqual(
      collection.filename,
      { template: "{primary}.md", field: true },
      ".pages.yml: filename template and visibility",
    );
  });

  it("lists title, homepage status, order and dates, sorted by order", () => {
    assert.equal(collection.view?.primary, "title", ".pages.yml: primary field");
    assert.deepEqual(collection.view?.fields, ["title", "featured", "order", "dates"], ".pages.yml: list columns");
    assert.deepEqual(collection.view?.sort, ["order", "title"], ".pages.yml: sortable columns");
    assert.deepEqual(collection.view?.default, { sort: "order", order: "asc" }, ".pages.yml: default order");
  });

  it("exposes title, venue, dates, both texts, homepage status and order with Spanish help text", () => {
    const fields = collection.fields ?? [];
    assert.deepEqual(
      fields.map((field) => field.name),
      ["title", "venue", "dates", "text_es", "text_en", "featured", "order", "gallery_columns", "media"],
      ".pages.yml: project fields",
    );

    for (const field of fields) {
      assert.ok(field.label, `.pages.yml: field "${field.name}" has no label`);
      assert.ok(field.description, `.pages.yml: field "${field.name}" has no description`);
    }

    const byName = (name) => fields.find((field) => field.name === name);
    assert.equal(byName("title").required, true, ".pages.yml: title is required");
    assert.equal(byName("featured").type, "boolean", ".pages.yml: featured is a boolean");
    assert.equal(byName("featured").default, false, ".pages.yml: projects start off the homepage");
    assert.equal(byName("order").type, "number", ".pages.yml: order is a number");
    assert.equal(byName("order").default, 0, ".pages.yml: order defaults to zero");
  });

  it("edits the Spanish and English project text as Markdown rich text", () => {
    const byName = (name) => collection.fields.find((field) => field.name === name);

    const spanish = byName("text_es");
    assert.equal(spanish?.type, "rich-text", ".pages.yml: text_es is rich text");
    assert.equal(spanish?.required, true, ".pages.yml: every project has Spanish text");
    assert.deepEqual(
      spanish?.options,
      RICH_TEXT_OPTIONS,
      ".pages.yml: text_es is Markdown with a source switch and the documents library (an editor uploads a PDF here and links it)",
    );

    const english = byName("text_en");
    assert.equal(english?.type, "rich-text", ".pages.yml: text_en is rich text");
    assert.notEqual(english?.required, true, ".pages.yml: English text is optional");
    assert.deepEqual(
      english?.options,
      RICH_TEXT_OPTIONS,
      ".pages.yml: text_en is Markdown with a source switch and the documents library",
    );

    assert.match(spanish.label, /español/i, ".pages.yml: the Spanish text field is labelled in Spanish");
    assert.match(english.label, /inglés/i, ".pages.yml: the English text field is labelled in Spanish");
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

  it("exposes both biographies and the team as Markdown rich text with Spanish labels", () => {
    const fields = entry?.fields ?? [];
    assert.deepEqual(fields.map((field) => field.name), ["bio_es", "bio_en", "team"], ".pages.yml: About fields");

    for (const field of fields) {
      assert.ok(field.label, `.pages.yml: About field "${field.name}" has no label`);
      assert.ok(field.description, `.pages.yml: About field "${field.name}" has no description`);
      assert.equal(field.type, "rich-text", `.pages.yml: About field "${field.name}" is rich text`);
      assert.deepEqual(
        field.options,
        RICH_TEXT_OPTIONS,
        `.pages.yml: About field "${field.name}" is Markdown with a source switch and the documents library`,
      );
    }

    const byName = (name) => fields.find((field) => field.name === name);
    assert.equal(byName("bio_es").required, true, ".pages.yml: the About page always has a Spanish biography");
    assert.notEqual(byName("bio_en").required, true, ".pages.yml: the English biography is optional");
    assert.match(byName("bio_es").label, /español/i, ".pages.yml: the Spanish biography field is labelled in Spanish");
    assert.match(byName("bio_en").label, /inglés/i, ".pages.yml: the English biography field is labelled in Spanish");
    assert.match(byName("team").label, /equipo/i, ".pages.yml: the team field is labelled in Spanish");
  });

  it("keeps the page layout out of the editor so a save preserves it", () => {
    assert.ok(entry, ".pages.yml: no `about` entry");
    // `title` and `layout` are developer-only keys: no field may write them, so
    // merge mode carries the page file's own values through every save.
    const exposed = [...(entry?.fields ?? []), ...(entry?.view?.fields ?? [])].map((field) =>
      typeof field === "string" ? field : field.name,
    );

    for (const name of ["title", "layout", "bio"]) {
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
    const richText = (config.content ?? []).flatMap((entry) => (entry.fields ?? []).filter(({ type }) => type === "rich-text"));
    assert.ok(richText.length > 0, ".pages.yml: expected the rich-text fields of the editor");

    for (const field of richText) {
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

  it("lets editors write alt text, a poster and the playback flags", () => {
    const [image, video] = field.blocks;
    const alt = image.fields.find(({ name }) => name === "alt");
    assert.equal(alt?.type, "string", ".pages.yml: image alt text field");
    assert.notEqual(alt?.required, true, ".pages.yml: alt text is optional (it falls back to the title)");

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
    const read = templateSettingsPaths();
    const readsPath = (fieldPath) => read.some((path) => path === fieldPath || path.startsWith(`${fieldPath}.`));

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
  return [
    ...new Set(
      templates.flatMap((file) =>
        [...readRepoFile(file).matchAll(/\bsite\.([A-Za-z0-9_.]+)/g)].map((match) => match[1].replace(/\.$/, "")),
      ),
    ),
  ].sort();
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

describe("sitemap (/sitemap.xml)", () => {
  const route = "/sitemap.xml";

  it("lists every page, including all twelve projects", () => {
    const listed = [...readText(route).matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    const routes = ["/", ABOUT_ROUTE, "/proyectos/", ...PROJECTS.map((project) => project.route)];

    assert.deepEqual(
      listed.sort(),
      routes.map((listedRoute) => `${SITE_URL}${localUrl(listedRoute)}`).sort(),
      `page ${route}: listed URLs`,
    );
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

  // The homepage renders the same gallery as the project page, so a listed
  // video must keep its control bar here too.
  it("renders every listed gallery video with the control bar its flags call for", () => {
    const doc = readPage(route);
    for (const project of HOMEPAGE_PROJECTS.filter(({ videos }) => videos.length)) {
      assertGalleryVideos(listedArticle(doc, route, project.title), project, route);
    }
  });
});

describe("archive page (/proyectos/)", () => {
  const route = "/proyectos/";

  it("lists every archive project, in order", () => {
    assert.deepEqual(
      listedTitles(readPage(route), route),
      ARCHIVE_PROJECTS.map((project) => project.title),
      `page ${route}: archive project titles and order`,
    );
  });

  for (const project of ARCHIVE_PROJECTS) {
    it(`links ${project.title} to its project page`, () => {
      const doc = readPage(route);
      const article = listedArticle(doc, route, project.title);
      assert.equal(
        article.querySelector("a")?.getAttribute("href"),
        localUrl(project.route),
        `page ${route}: link to ${project.title}`,
      );
    });
  }

  // No archive project carries a video today, so this is a no-op until one
  // does; it keeps the archive surface covered the moment that changes.
  it("renders every listed gallery video with the control bar its flags call for", () => {
    const doc = readPage(route);
    for (const project of ARCHIVE_PROJECTS.filter(({ videos }) => videos.length)) {
      assertGalleryVideos(listedArticle(doc, route, project.title), project, route);
    }
  });
});

describe("project pages", () => {
  for (const project of PROJECTS) {
    const { route, title } = project;
    const label = `page ${route}`;
    const text = () => normalize(projectArticle(route).textContent);

    it(`${route} renders its title`, () => {
      const heading = projectArticle(route).querySelector("h1, h2");
      assert.equal(normalize(heading?.textContent), title, `${label}: project title heading`);
      assert.equal(normalize(readPage(route).querySelector("title")?.textContent), `${title} — ${SITE.title}`, `${label}: <title>`);
    });

    it(`${route} renders its venue and dates`, () => {
      if (project.venue) {
        assert.ok(text().includes(project.venue), `${label}: venue "${project.venue}"`);
      }
      assert.ok(text().includes(project.dates), `${label}: dates "${project.dates}"`);
      assert.ok(!text().includes("undefined"), `${label}: page text contains "undefined"`);
    });

    it(`${route} renders its Spanish text`, () => {
      assert.ok(text().includes(project.spanish), `${label}: Spanish text "${project.spanish}"`);
    });

    if (project.english) {
      it(`${route} renders its English text`, () => {
        assert.ok(text().includes(project.english), `${label}: English text "${project.english}"`);
      });
    }

    it(`${route} renders its gallery`, () => {
      const article = projectArticle(route);
      const alts = expectedImageAlt(route);

      const pictures = article.querySelectorAll("picture");
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
      assertGalleryVideos(article, project, route);
    });
  }
});

describe("bilingual project text", () => {
  /** Projects the baseline lists an English text for; the rest are Spanish only. */
  const BILINGUAL = PROJECTS.filter((project) => project.english);
  const SPANISH_ONLY = PROJECTS.filter((project) => !project.english);
  const isDivider = ({ element }) => element.classList.contains("project-body__divider");

  /** The page's text column split at its divider: what comes before and after. */
  function sides(route) {
    const blocks = projectBodyBlocks(route);
    const dividers = blocks.filter(isDivider);
    assert.equal(dividers.length, 1, `page ${route}: a bilingual project has exactly one divider`);
    assert.equal(dividers[0].text, "//", `page ${route}: the divider is the "//" mark`);

    const at = blocks.indexOf(dividers[0]);
    return { dividers, spanish: blocks.slice(0, at), english: blocks.slice(at + 1) };
  }

  it("renders the Spanish text first and the English text after the divider", () => {
    assert.equal(BILINGUAL.length, BILINGUAL_PROJECT_COUNT, "fixture: expected three bilingual projects");

    for (const { route, spanish, english } of BILINGUAL) {
      const label = `page ${route}`;
      const { spanish: before, english: after } = sides(route);

      assert.ok(
        before.map((block) => block.text).join(" ").includes(spanish),
        `${label}: Spanish text "${spanish}" comes before the divider`,
      );
      assert.ok(
        after.map((block) => block.text).join(" ").includes(english),
        `${label}: English text "${english}" comes after the divider`,
      );
    }
  });

  it("draws the divider in the template, never as content", () => {
    for (const { route } of BILINGUAL) {
      // The mark stands alone in its own block with the styling hook; any other
      // "//" block would be a leftover content separator.
      const marks = projectBodyBlocks(route).filter((block) => block.text === "//");
      assert.equal(marks.length, 1, `page ${route}: exactly one "//" block`);
      assert.ok(isDivider(marks[0]), `page ${route}: the "//" block is the template divider`);
    }
  });

  it("renders Spanish-only projects without a divider", () => {
    assert.ok(SPANISH_ONLY.length > 0, "fixture: expected Spanish-only projects");

    for (const { route } of SPANISH_ONLY) {
      assert.deepEqual(
        projectBodyBlocks(route).filter(isDivider),
        [],
        `page ${route}: a Spanish-only project has no divider`,
      );
    }
  });

  it("keeps Corteza Líquida's Spanish artist biography on the Spanish side", () => {
    const project = PROJECTS.find(({ biography }) => biography);
    assert.ok(project, "fixture: expected a project whose biography exists in both languages");
    const { route, biography } = project;
    const { spanish, english } = sides(route);
    const spanishText = spanish.map((block) => block.text).join(" ");
    const englishText = english.map((block) => block.text).join(" ");

    // The biography exists in both languages; each one stays with its language.
    assert.ok(
      spanishText.includes(biography.spanish),
      `page ${route}: the Spanish biography comes before the divider`,
    );
    assert.ok(
      englishText.includes(biography.english),
      `page ${route}: the English biography comes after the divider`,
    );

    // The dossier is language-neutral and must not vanish with the English text.
    assert.ok(/Dossier/.test(spanishText), `page ${route}: the dossier stays with the Spanish text`);
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

describe("about page (/acerca-de/)", () => {
  const route = ABOUT_ROUTE;
  const text = () => normalize(readPage(route).querySelector("main")?.textContent);

  /** The text blocks of the biography column, in document order. */
  const bioBlocks = () => {
    const bio = readPage(route).querySelector("main .about-bio");
    assert.ok(bio, `page ${route}: no biography rendered`);
    return bio.childNodes
      .filter((node) => node.nodeType === NodeType.ELEMENT_NODE)
      .map((node) => normalize(node.textContent));
  };

  it("renders the Spanish biography", () => {
    assert.ok(text().includes(ABOUT.spanish), `page ${route}: Spanish bio "${ABOUT.spanish}"`);
  });

  it("renders the English biography", () => {
    assert.ok(text().includes(ABOUT.english), `page ${route}: English bio "${ABOUT.english}"`);
  });

  it("renders the Spanish bio first, one divider, then the English bio", () => {
    const blocks = bioBlocks();
    const spanish = blocks.findIndex((block) => block.startsWith(ABOUT.spanish));
    const english = blocks.findIndex((block) => block.startsWith(ABOUT.english));
    const dividers = blocks.flatMap((block, index) => (block === "//" ? [index] : []));

    assert.notEqual(spanish, -1, `page ${route}: the Spanish biography is its own text block`);
    assert.notEqual(english, -1, `page ${route}: the English biography is its own text block`);
    assert.equal(dividers.length, 1, `page ${route}: the template draws one divider between the biographies`);
    assert.ok(spanish < dividers[0], `page ${route}: the Spanish biography comes before the divider`);
    assert.ok(dividers[0] < english, `page ${route}: the English biography comes after the divider`);
  });

  it("renders the team", () => {
    for (const member of ABOUT.team) {
      assert.ok(text().includes(member), `page ${route}: team copy "${member}"`);
    }
  });

  it("stores each biography language in its own field, without the separator", () => {
    const data = projectData("src/acerca-de.md");
    const spanish = String(data.bio_es ?? "").trim();
    const english = String(data.bio_en ?? "").trim();

    assert.ok(spanish.startsWith(ABOUT.spanish), `page ${route}: "bio_es" starts the Spanish biography`);
    assert.ok(english.startsWith(ABOUT.english), `page ${route}: "bio_en" starts the English biography`);
    assert.ok(!Object.hasOwn(data, "bio"), `page ${route}: the legacy "bio" field is gone`);
    assert.equal(typeof data.team, "string", `page ${route}: the team is one rich-text field`);

    for (const key of ["bio_es", "bio_en", "team"]) {
      assert.ok(
        !/^[ \t]*\/\/[ \t]*$/m.test(String(data[key] ?? "")),
        `page ${route}: "${key}" contains a literal // separator line (the template draws the divider)`,
      );
    }
  });

  it("renders the team after both biographies, from the one team field", () => {
    const blocks = bioBlocks();
    const body = text();
    const english = blocks.findIndex((block) => block.startsWith(ABOUT.english));
    const team = readPage(route).querySelector("main .about-team");
    assert.ok(team, `page ${route}: no team section rendered`);

    assert.notEqual(english, -1, `page ${route}: the English biography is its own text block`);
    assert.ok(body.indexOf(ABOUT.team[0]) > body.indexOf(ABOUT.english), `page ${route}: the team comes after the biographies`);
    assert.ok(
      normalize(team.textContent).includes(ABOUT.team.at(-1)),
      `page ${route}: the team section carries the whole team copy`,
    );
  });
});

describe("site settings in the generated pages", () => {
  const settings = JSON.parse(readRepoFile("src/_data/site.json"));

  it("renders the header and footer copy from the settings file", () => {
    const homepage = readPage("/");
    const text = (selector) => normalize(homepage.querySelector(selector)?.textContent);

    assert.equal(text(`header a[href="${localUrl(ABOUT_ROUTE)}"]`), settings.nav.about.label, "header: About label and target");
    assert.equal(text(`header a[href="${localUrl("/proyectos/")}"]`), settings.nav.projects.label, "header: archive label and target");
    assert.equal(text(`header a[href="mailto:${settings.contactEmail}"]`), settings.contactName, "header: contact link");
    assert.equal(text("header .site-nav__email"), settings.email, "header: the e-mail shown as text");

    const footer = normalize(homepage.querySelector(".site-footer")?.textContent);
    for (const value of [settings.footer.copyright, settings.footer.city, settings.footer.instagram]) {
      assert.ok(footer.includes(value), `footer: shows "${value}"`);
    }
  });

  it("titles every page and describes the homepage from the settings file", () => {
    const homepage = readPage("/");

    assert.equal(normalize(homepage.querySelector('meta[property="og:site_name"]')?.getAttribute("content")), settings.title);
    assert.equal(homepage.querySelector("title")?.textContent, settings.title, "page /: title is the site name");
    assert.ok(
      readPage(ABOUT_ROUTE).querySelector("title")?.textContent.endsWith(`— ${settings.title}`),
      `page ${ABOUT_ROUTE}: the site name follows the page title`,
    );
    assert.equal(
      normalize(homepage.querySelector('meta[name="description"]')?.getAttribute("content")),
      settings.description,
      "page /: meta description is the site description",
    );
  });

  it("leaves the informational settings out of the pages", () => {
    // `social.instagram` is the one informational value that no rendered page
    // repeats or derives from another setting, so its absence is checkable.
    // (`url` is what the deploy sets as SITE_URL, and `instagram` / `city`
    // repeat the footer values; the canonical assertions elsewhere pin the
    // origin to SITE_URL, which is what proves `url` is never read.)
    const pages = ["/", ABOUT_ROUTE, "/proyectos/"].map((page) => readText(path.posix.join(page, "index.html")));
    for (const html of pages) {
      assert.ok(!html.includes(settings.social.instagram), "no page renders the social.instagram reference URL");
    }
  });
});

describe("page metadata", () => {
  const pages = [["/", SITE.description], ...PROJECTS.map((project) => [project.route, null]), [ABOUT_ROUTE, SITE.description]];

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

  it("describes each project with the start of its Spanish text", () => {
    for (const file of projectFiles()) {
      const route = projectRoute(file);
      const description = normalize(readPage(route).querySelector('meta[name="description"]')?.getAttribute("content"));
      assert.ok(description.length > 0, `page ${route}: meta description is empty`);

      // The description is the rendered Spanish text with its tags stripped and
      // truncated, so comparing against the raw field only needs the emphasis
      // markers removed and the truncation mark ignored.
      const plain = normalize(String(projectData(file).text_es ?? "").replace(/\*/g, ""));
      assert.ok(
        plain.startsWith(description.replace(/(\.{3}|…)$/, "")),
        `page ${route}: meta description "${description}" starts the Spanish text`,
      );
    }
  });
});

/**
 * The three surfaces (project page, homepage, archive page) share one rendering
 * path. These assertions pin the per-surface differences that path centralizes:
 * heading level, linked titles, gallery columns, and first-image priority.
 */
describe("project rendering contract", () => {
  const LISTING_ROUTES = ["/", "/proyectos/"];

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

/** Every page that renders project text, and so can carry its links. */
const PAGES_WITH_PROJECT_TEXT = ["/", "/proyectos/", ...PROJECTS.map((project) => project.route)];

/** The project content file behind a project route. */
const sourceOf = (route) => projectFiles().find((file) => projectRoute(file) === route);

/** Links rendered inside the project text of a page, in document order. */
function bodyLinks(pageRoute) {
  return readPage(pageRoute)
    .querySelectorAll("main .project-body")
    .flatMap((body) => body.querySelectorAll("a"));
}

/** A URL the site itself owns: root-relative, no scheme, no host. */
const isLocalRootRelative = (href) => href.startsWith("/") && !href.startsWith("//");

describe("local document links", () => {
  it("links each local document from its project page, under the deployment path prefix", () => {
    for (const { route, label, file } of LOCAL_DOCUMENTS) {
      const links = bodyLinks(route).filter((link) => normalize(link.textContent) === label);
      assert.equal(links.length, 1, `page ${route}: exactly one “${label}” link`);
      assert.equal(
        links[0].getAttribute("href"),
        localUrl(`/assets/files/${file}`),
        `page ${route}: the “${label}” link points at the document under the path prefix`,
      );
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
    for (const project of PROJECTS) {
      const source = String(projectData(sourceOf(project.route)).text_es ?? "");
      const external = [...source.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map((match) => match[1]);
      if (!external.length) continue;

      const rendered = bodyLinks(project.route)
        .map((link) => link.getAttribute("href"))
        .filter((href) => /^https?:\/\//.test(href));
      assert.deepEqual(rendered, external, `page ${project.route}: external links are untouched`);
    }
  });

  it("repairs the malformed link wrappers into single links", () => {
    for (const { route, label } of LOCAL_DOCUMENTS) {
      const blocks = projectBodyBlocks(route).filter((block) => block.text.includes(label));
      assert.equal(blocks.length, 1, `page ${route}: “${label}” renders as one block`);

      const { element, text } = blocks[0];
      const anchors = element.querySelectorAll("a");
      assert.equal(anchors.length, 1, `page ${route}: “${label}” is a single link, not split text`);
      assert.equal(text, label, `page ${route}: the “${label}” block carries only the link text`);
      assert.ok(!/\]\(/.test(text), `page ${route}: no raw Markdown link residue around “${label}”`);
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
 * Ticket #10: the same site built for a GitHub Pages subpath. The default run
 * builds it too, so a URL that skips the prefix fails the suite on every run;
 * `PATH_PREFIX=/.../ npm test` covers a custom prefix instead.
 */
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
    for (const route of ["/", "/proyectos/", PROJECTS[0].route, THREE_COLUMN_ROUTE, ABOUT_ROUTE]) {
      const urls = localUrls(page(route));
      assert.ok(urls.length > 0, `page ${route}: no local URLs rendered`);
      for (const url of urls) {
        assert.ok(url.startsWith(`${PREFIX}/`), `page ${route}: ${url} carries the path prefix`);
        assert.ok(!url.startsWith(`${PREFIX}${PREFIX}/`), `page ${route}: ${url} is prefixed exactly once`);
      }
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
