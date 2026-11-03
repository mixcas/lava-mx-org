/**
 * Eleventy configuration.
 * Docs: https://www.11ty.dev/docs/config/
 */
import path from "node:path";
import Image from "@11ty/eleventy-img";
import MarkdownIt from "markdown-it";

import { buildProjectView } from "./lib/project-view.js";
import { applyPathPrefix, withPathPrefix } from "./lib/path-prefix.js";
import { assertProjectsValid, untranslatedFields, untranslatedReport } from "./lib/project-contract.js";
import { languageAlternates, languageRoutes, localizedText, sitemapEntries } from "./lib/languages.js";
import { ASSET_URL } from "./lib/media-assets.js";
import { languageRouteUrl } from "./lib/routes.js";

const ROOT = import.meta.dirname;

// `/` for a custom domain; `/<repo>/` when served from a GitHub Pages subpath.
const PATH_PREFIX = (process.env.PATH_PREFIX || "/").replace(/\/+$/, ""); // "" | "/repo"
const SITE_URL = (process.env.SITE_URL || "https://lava-mx.org").replace(/\/$/, "");
const IMAGE_URL_PATH = `${PATH_PREFIX}/img/`; // "/img/" | "/repo/img/"
const IMAGES_DIR = path.join("src", "assets", "images");
const RESPONSIVE_WIDTHS = [640, 1024, 1440, 1920, 2560, 3200];

/** Process an image master into responsive WebP + AVIF variants. */
async function processImage(src, widths) {
  const input = path.join(IMAGES_DIR, src);
  const stats = await Image(input, { statsOnly: true, formats: ["webp"] });
  const sourceWidth = Math.max(...Object.values(stats).flat().map((format) => format.width));
  let chosen = widths.filter((width) => width < sourceWidth);
  // Always include the native width so full source detail is reachable
  // (never upscale). Without this, a source between two steps (e.g. 1365px)
  // would be stuck at the smaller step (1024) and look softer than the original.
  chosen.push(sourceWidth);

  return Image(input, {
    widths: chosen,
    formats: ["avif", "webp"],
    outputDir: "./_site/img/",
    urlPath: IMAGE_URL_PATH,
    sharpWebpOptions: { quality: 88, effort: 4 },
    sharpAvifOptions: { quality: 80, effort: 4 },
  });
}

export default function (eleventyConfig) {
  // Project content contract (lib/project-contract.js): reject invalid project
  // front matter before any page renders, with a message naming the project file
  // and field — a broken project must never reach the output.
  //
  // Then the editorial translation tracker (ADR-0002): the list of English
  // values still absent, printed without failing the build, since an
  // untranslated project must never block a deploy. `forceLog` is what makes it
  // survive quiet mode (`setQuietMode(true)`, as the test suite builds).
  eleventyConfig.on("eleventy.before", ({ inputDir, dir }) => {
    const contentDir = path.resolve(ROOT, inputDir ?? dir.input);
    assertProjectsValid({ inputDir: contentDir });

    const report = untranslatedReport(untranslatedFields({ inputDir: contentDir }));
    if (report) eleventyConfig.logger.forceLog(report);
  });

  // Static assets copied verbatim. Image masters are NOT copied — they are
  // processed by @11ty/eleventy-img into responsive variants under /img/.
  eleventyConfig.addPassthroughCopy({ "src/assets/css": "assets/css" });
  eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });
  eleventyConfig.addPassthroughCopy({ "src/assets/fonts": "assets/fonts" });
  eleventyConfig.addPassthroughCopy({ "src/assets/videos": "assets/videos" });
  eleventyConfig.addPassthroughCopy({ "src/assets/files": "assets/files" });
  eleventyConfig.addPassthroughCopy({ "src/assets/favicon.ico": "assets/favicon.ico" });
  eleventyConfig.addPassthroughCopy({
    "src/assets/images/lava-logo.png": "assets/images/lava-logo.png",
  });

  // Cargo content used <br> for line breaks; render single newlines as breaks.
  eleventyConfig.amendLibrary("md", (md) => md.set({ breaks: true, html: true }));

  // Absolute site origin (for canonical/OG/sitemap URLs).
  eleventyConfig.addGlobalData("siteUrl", SITE_URL);

  // Canonical project view model (see lib/project-view.js): every project
  // surface renders this, so content shapes are interpreted in one place.
  // `projectView` computed data serves the page being built (the project layout);
  // the `projectView` / `projectViews` filters serve collection items on the
  // listing pages.
  eleventyConfig.addFilter("projectView", (item) => buildProjectView(item?.data ?? item ?? {}));
  eleventyConfig.addFilter("projectViews", (items = []) => items.map((item) => buildProjectView(item?.data ?? item ?? {})));
  eleventyConfig.addGlobalData("eleventyComputed", {
    projectView: (data) => buildProjectView(data),
    // Hero image (LCP/OG) per page: the first image of the page's own gallery,
    // else the first image of the homepage/archive project collections (per the
    // `hero` front-matter flag).
    heroImage: (data) => {
      const project = buildProjectView(data);
      if (project.gallery.length) return project.heroImage;
      const list =
        data.hero === "featured"
          ? data.collections?.featuredProjects
          : data.hero === "archive"
            ? data.collections?.archiveProjects
            : null;
      return list?.length ? buildProjectView(list[0].data).heroImage : null;
    },
  });

  // Render Markdown stored in front matter (bilingual body, venue/dates, about).
  // Content links local assets root-relative (`/assets/files/…`), so the
  // rendered HTML gets the deployment path prefix here — the same prefix the
  // templates get from Eleventy's `url` filter (see lib/path-prefix.js).
  const mdLib = new MarkdownIt({ html: true, breaks: true });
  eleventyConfig.addFilter("md", (value) => applyPathPrefix(mdLib.render(String(value ?? "")), PATH_PREFIX));
  eleventyConfig.addFilter("mdInline", (value) => applyPathPrefix(mdLib.renderInline(String(value ?? "")), PATH_PREFIX));

  // The site settings store a route key for each header link, not a URL; the
  // layout builds the address from it inside the page's language tree (see
  // lib/routes.js): `/proyectos/` in Spanish, `/en/proyectos/` in English.
  eleventyConfig.addFilter("languageRouteUrl", languageRouteUrl);

  // The language registry and its two readers (see lib/languages.js): every
  // route Eleventy built, mapped to the language versions that exist. The
  // chrome's language link, the hreflang metadata and the sitemap all read it,
  // so a page that gains a language version advertises it in the same build.
  eleventyConfig.addCollection("languageRoutes", (api) => languageRoutes(api.getAll()));
  eleventyConfig.addFilter("languageAlternates", languageAlternates);
  eleventyConfig.addFilter("sitemapEntries", sitemapEntries);

  // The Untranslated field rule (GLOSSARY, ADR-0002), for pages that carry their
  // text per language rather than through the project view model: reads one
  // field of a page's language objects and shows the Spanish value when that
  // language has none, silently — clearing every English field in the CMS is a
  // legal state (see lib/languages.js).
  eleventyConfig.addFilter("localizedText", localizedText);

  // Responsive <picture> for a master filename in src/assets/images.
  // `priority` marks the LCP image (eager + high fetch priority).
  const picture = async (src, alt = "", priority = false, sizes = "(min-width: 900px) 66vw, 100vw") => {
    const metadata = await processImage(src, RESPONSIVE_WIDTHS);
    return Image.generateHTML(metadata, {
      alt,
      sizes,
      loading: priority ? "eager" : "lazy",
      decoding: priority ? "sync" : "async",
      fetchpriority: priority ? "high" : "low",
    });
  };
  eleventyConfig.addShortcode("picture", picture);

  // Single URL (e.g. for a video poster or OG image). WebP is widely supported.
  const imageUrl = async (src, width = 1200) => {
    const metadata = await processImage(src, [Number(width)]);
    const format = metadata.webp ? "webp" : "avif";
    return metadata[format][metadata[format].length - 1].url;
  };
  eleventyConfig.addShortcode("imageUrl", imageUrl);

  // A project gallery: the one place media items become markup. It renders the
  // view model's typed media items (`lib/project-view.js`) for every project
  // surface — image, video, and its flags — and keeps `data-columns` here too.
  // It is also where a video's control bar is decided: a self-sustaining video
  // (autoplay + mute + loop) stays chrome-free, everything else gets controls.
  eleventyConfig.addShortcode("gallery", async (gallery, columns = null, priority = false) => {
    const items = await Promise.all(
      (Array.isArray(gallery) ? gallery : []).map(async (item, index) => {
        if (item.type === "video") {
          const poster = item.poster ? ` poster="${await imageUrl(item.poster, 1200)}"` : "";
          const autoplay = item.autoplay ? " autoplay" : "";
          const loop = item.loop ? " loop" : "";
          const mute = item.mute ? " muted" : "";
          // Only a self-sustaining video — autoplay + mute + loop — is
          // decoration with nothing for a viewer to operate. Every other video
          // gets the browser's control bar, including a muted one-shot that
          // autoplays without loop and would otherwise end on a dead frame.
          const controls = item.autoplay && item.mute && item.loop ? "" : " controls";
          // Videos are copied verbatim, so the same path-prefix rule applies
          // as for every other URL the site owns (lib/path-prefix.js).
          const src = withPathPrefix(`${ASSET_URL.videos}/${item.src}`, PATH_PREFIX);
          return `<video class="project-video" src="${src}"${poster}${autoplay}${loop}${mute}${controls} playsinline preload="metadata"></video>`;
        }
        return picture(item.src, item.alt, priority && index === 0);
      }),
    );
    const columnCount = columns ? ` data-columns="${columns}"` : "";
    return `<div class="project-gallery"${columnCount}>\n\t${items.join("\n\t")}\n</div>`;
  });

  // Preload the LCP image early (uses the same responsive srcset as <picture>).
  eleventyConfig.addShortcode(
    "imagePreload",
    async (src, sizes = "(min-width: 900px) 66vw, 100vw") => {
      if (!src) return "";
      const metadata = await processImage(src, RESPONSIVE_WIDTHS);
      const list = metadata.avif || metadata.webp || [];
      if (!list.length) return "";
      const type = metadata.avif ? "image/avif" : "image/webp";
      const srcset = list.map((img) => `${img.url} ${img.width}w`).join(", ");
      return `<link rel="preload" as="image" type="${type}" imagesrcset="${srcset}" imagesizes="${sizes}">`;
    },
  );

  // Project collections: the editor-selected homepage projects and the
  // complementary archive projects, each in its configured `order`.
  const byOrder = (a, b) => (a.data.order ?? 0) - (b.data.order ?? 0);
  eleventyConfig.addCollection("featuredProjects", (api) =>
    api
      .getFilteredByGlob("src/proyectos/*.md")
      .filter((item) => item.data.featured === true)
      .sort(byOrder),
  );
  eleventyConfig.addCollection("archiveProjects", (api) =>
    api
      .getFilteredByGlob("src/proyectos/*.md")
      .filter((item) => item.data.featured !== true)
      .sort(byOrder),
  );

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      layouts: "_includes/layouts",
      data: "_data",
    },
    pathPrefix: process.env.PATH_PREFIX || "/",
    templateFormats: ["njk", "md", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk",
  };
}
