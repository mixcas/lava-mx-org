import assert from "node:assert/strict";
import path from "node:path";
import { before, describe, it } from "node:test";

import yaml from "js-yaml";
import { NodeType } from "node-html-parser";

import { frontMatter, projectData, projectFiles, projectRoute } from "./support/content.mjs";
import { ABOUT, ARCHIVE_PROJECTS, HOMEPAGE_PROJECTS, PROJECTS, SITE } from "./support/projects.mjs";
import {
  buildSite,
  listOutput,
  localUrl,
  normalize,
  PATH_PREFIX,
  readPage,
  readRepoFile,
  readText,
  SITE_URL,
} from "./support/site.mjs";

/** About page route (see GLOSSARY: the collective's identity page). */
const ABOUT_ROUTE = "/acerca-de/";

/** The one project that keeps the three-column layout. */
const THREE_COLUMN_ROUTE = "/proyectos/infernal-natures/";

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

describe("project URLs", () => {
  it("keeps all twelve project URLs", () => {
    assert.equal(PROJECTS.length, 12, "fixture: expected twelve baseline projects");
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
      const keys = Object.keys(frontMatter(file));
      for (const legacy of ["current", "slug", "layout", "media_left", "media_middle"]) {
        assert.ok(!keys.includes(legacy), `${file}: front matter still carries the legacy "${legacy}" key`);
      }
    }
  });

  it("keeps only non-default values in project front matter", () => {
    for (const file of projectFiles()) {
      const keys = frontMatter(file);

      if ("variant" in keys) {
        assert.equal(keys.variant, "three-column", `${file}: "variant" only appears when it is not the standard variant`);
      }
      if ("gallery_columns" in keys) {
        assert.notEqual(keys.gallery_columns, "1", `${file}: "gallery_columns" only appears when it is not one column`);
      }
      if ("featured" in keys) {
        assert.equal(keys.featured, "true", `${file}: "featured" only appears for homepage projects`);
      }
    }
  });

  /** The keys a typed gallery item may carry (see GLOSSARY: Media item). */
  const ITEM_KEYS = { image: ["type", "src", "alt"], video: ["type", "src", "poster", "autoplay", "loop", "mute"] };
  /** Media sources are canonical asset paths; the basename names the master. */
  const CANONICAL = { image: /^\/assets\/images\/[^/]+$/, video: /^\/assets\/videos\/[^/]+$/ };
  const MASTER_DIR = { image: "src/assets/images", video: "src/assets/videos" };

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
          const masterDir = master.startsWith("/assets/images/") ? MASTER_DIR.image : MASTER_DIR.video;
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
      { format: "markdown", switcher: true, media: false },
      ".pages.yml: text_es is Markdown with a source switch and no body media (the text lives in front matter)",
    );

    const english = byName("text_en");
    assert.equal(english?.type, "rich-text", ".pages.yml: text_en is rich text");
    assert.notEqual(english?.required, true, ".pages.yml: English text is optional");
    assert.deepEqual(
      english?.options,
      { format: "markdown", switcher: true, media: false },
      ".pages.yml: text_en is Markdown with a source switch and no body media",
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

describe("Pages CMS media sources (.pages.yml)", () => {
  const config = yaml.load(readRepoFile(".pages.yml"));
  const sources = Object.fromEntries((config.media ?? []).map((source) => [source.name, source]));

  /** Images the image pipeline handles; anything else would break the build. */
  const IMAGE_EXTENSIONS = ["avif", "gif", "jpeg", "jpg", "png", "webp"];

  it("defines image, video and document sources under the folders the site serves", () => {
    assert.deepEqual(Object.keys(sources), ["images", "videos", "documents"], ".pages.yml: media sources");
    assert.deepEqual(
      Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, [source.input, source.output]])),
      {
        images: ["src/assets/images", "/assets/images"],
        videos: ["src/assets/videos", "/assets/videos"],
        documents: ["src/assets/files", "/assets/files"],
      },
      ".pages.yml: media source folders and the canonical paths written into content",
    );
  });

  it("accepts only the formats the site can publish", () => {
    assert.deepEqual([...sources.images.extensions].sort(), IMAGE_EXTENSIONS, ".pages.yml: image upload formats");
    assert.deepEqual([...sources.videos.extensions].sort(), ["mp4", "webm"], ".pages.yml: video upload formats");
    assert.deepEqual(sources.documents.extensions, ["pdf"], ".pages.yml: document upload formats");
  });

  it("preserves original upload filenames", () => {
    for (const [name, source] of Object.entries(sources)) {
      assert.equal(source.rename, false, `.pages.yml: the "${name}" source keeps original filenames`);
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
      const article = doc
        .querySelectorAll("article")
        .find((element) => normalize(element.querySelector("h1, h2")?.textContent) === project.title);
      assert.ok(article, `page ${route}: no article for ${project.title}`);
      assert.equal(
        article.querySelector("a")?.getAttribute("href"),
        localUrl(project.route),
        `page ${route}: link to ${project.title}`,
      );
    });
  }
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

      const pictures = article.querySelectorAll("picture");
      assert.equal(pictures.length, project.images, `${label}: gallery images rendered`);
      pictures.forEach((picture, index) => {
        const position = `gallery image ${index + 1}`;
        const img = picture.querySelector("img");
        assert.ok(img, `${label}: ${position} has no <img>`);
        assert.equal(img.getAttribute("alt"), title, `${label}: ${position} alt text`);
        assert.ok(
          (img.getAttribute("src") ?? "").startsWith(`${PATH_PREFIX}/img/`),
          `${label}: ${position} src "${img.getAttribute("src")}" uses the responsive image pipeline`,
        );
        assert.ok(
          (img.getAttribute("srcset") ?? "").includes(`${PATH_PREFIX}/img/`),
          `${label}: ${position} srcset uses the responsive image pipeline`,
        );
      });

      const videos = article.querySelectorAll("video");
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
      });
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
    assert.equal(BILINGUAL.length, 3, "fixture: expected three bilingual projects");

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
    const route = "/proyectos/corteza-liquida/";
    const { spanish, english } = sides(route);
    const spanishText = spanish.map((block) => block.text).join(" ");
    const englishText = english.map((block) => block.text).join(" ");

    // The biography exists in both languages; each one stays with its language.
    assert.ok(
      spanishText.includes("es una artista visual cuya práctica abarca el dibujo, la escultura"),
      `page ${route}: the Spanish biography comes before the divider`,
    );
    assert.ok(
      englishText.includes("is a visual artist whose practice encompasses drawing, sculpture"),
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

  it("renders the Spanish biography", () => {
    assert.ok(text().includes(ABOUT.spanish), `page ${route}: Spanish bio "${ABOUT.spanish}"`);
  });

  it("renders the English biography", () => {
    assert.ok(text().includes(ABOUT.english), `page ${route}: English bio "${ABOUT.english}"`);
  });

  it("renders the team", () => {
    for (const member of ABOUT.team) {
      assert.ok(text().includes(member), `page ${route}: team copy "${member}"`);
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
  /** Projects whose gallery is laid out in two columns (see GLOSSARY: Gallery). */
  const TWO_COLUMN_PROJECTS = new Set(["/proyectos/lianas-neotropicales/"]);
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
        TWO_COLUMN_PROJECTS.has(route) ? "2" : "1",
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
    const baseline = PROJECTS.find((project) => project.route === THREE_COLUMN_ROUTE);
    const total = baseline.gallery.length;
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
    assert.equal(eager("/proyectos/mineralia-indisciplinada/").length, 1, "page /proyectos/mineralia-indisciplinada/: one eager image");

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
