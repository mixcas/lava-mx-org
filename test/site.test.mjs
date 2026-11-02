import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { ABOUT, ARCHIVE_PROJECTS, HOMEPAGE_PROJECTS, PROJECTS, SITE } from "./support/projects.mjs";
import { buildSite, localUrl, normalize, PATH_PREFIX, readPage, SITE_URL } from "./support/site.mjs";

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
