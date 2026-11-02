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
      for (const legacy of ["current", "slug", "layout"]) {
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

  /** Standard projects: every project except the three-column variant. */
  const standardProjects = () => projectFiles().filter((file) => !("variant" in projectData(file)));

  /** The keys a typed gallery item may carry (see GLOSSARY: Media item). */
  const ITEM_KEYS = { image: ["type", "src", "alt"], video: ["type", "src", "poster", "autoplay", "loop", "mute"] };
  /** Media sources are canonical asset paths; the basename names the master. */
  const CANONICAL = { image: /^\/assets\/images\/[^/]+$/, video: /^\/assets\/videos\/[^/]+$/ };
  const MASTER_DIR = { image: "src/assets/images", video: "src/assets/videos" };

  it("models every standard gallery as ordered typed media items", () => {
    const files = standardProjects();
    assert.equal(files.length, PROJECTS.length - 1, "fixture: expected eleven standard projects");

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
    for (const file of standardProjects()) {
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

      const data = projectData(file);
      const items = [...(data.media ?? []), ...(data.media_left ?? []), ...(data.media_middle ?? [])];
      assert.equal(items.length, project.images + project.videos.length, `${file}: media items in the gallery`);
      assert.equal(
        items.filter((item) => item.type !== "video" && item.video !== true).length,
        project.images,
        `${file}: gallery images`,
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

  it("exposes title, venue, dates, homepage status and order with Spanish help text", () => {
    const fields = collection.fields ?? [];
    assert.deepEqual(
      fields.map((field) => field.name),
      ["title", "venue", "dates", "featured", "order", "gallery_columns", "media"],
      ".pages.yml: project fields (text arrives in a later ticket)",
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

  it("stores gallery columns as a number of one or two", () => {
    const field = collection.fields.find(({ name }) => name === "gallery_columns");

    assert.equal(field.type, "number", ".pages.yml: gallery columns are stored as a real number");
    assert.deepEqual([field.options.min, field.options.max], [1, 2], ".pages.yml: one or two gallery columns");
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
});

/**
 * The three surfaces (project page, homepage, archive page) share one rendering
 * path. These assertions pin the per-surface differences that path centralizes:
 * heading level, linked titles, gallery columns, and first-image priority.
 */
describe("project rendering contract", () => {
  /** Projects whose gallery is laid out in two columns (see GLOSSARY: Gallery). */
  const TWO_COLUMN_PROJECTS = new Set(["/proyectos/lianas-neotropicales/"]);
  /** The one project that keeps the three-column layout. */
  const THREE_COLUMN_ROUTE = "/proyectos/infernal-natures/";
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

  it("splits the three-column project into two galleries without losing media", () => {
    const article = projectArticle(THREE_COLUMN_ROUTE);
    const galleries = article.querySelectorAll(".project-gallery");
    assert.equal(galleries.length, 2, `page ${THREE_COLUMN_ROUTE}: three-column layout has two galleries`);
    for (const gallery of galleries) {
      assert.equal(gallery.hasAttribute("data-columns"), false, `page ${THREE_COLUMN_ROUTE}: three-column galleries take no column count`);
    }
    const expected = PROJECTS.find((project) => project.route === THREE_COLUMN_ROUTE).images;
    const rendered = galleries.reduce((total, gallery) => total + gallery.querySelectorAll("picture").length, 0);
    assert.equal(rendered, expected, `page ${THREE_COLUMN_ROUTE}: media items across both galleries`);
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
