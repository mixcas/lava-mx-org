/**
 * Eleventy configuration.
 * Docs: https://www.11ty.dev/docs/config/
 */
import path from "node:path";
import Image from "@11ty/eleventy-img";
import MarkdownIt from "markdown-it";

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
  let chosen = widths.filter((width) => width <= sourceWidth);
  if (!chosen.length) chosen = [sourceWidth];

  return Image(input, {
    widths: chosen,
    formats: ["avif", "webp"],
    outputDir: "./_site/img/",
    urlPath: IMAGE_URL_PATH,
    sharpWebpOptions: { quality: 88, effort: 4 },
    sharpAvifOptions: { quality: 65, effort: 4 },
  });
}

export default function (eleventyConfig) {
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

  // Hero image (LCP) per page: first image of the page/project, else first item
  // of the current/past project collections (per the `hero` front-matter flag).
  eleventyConfig.addGlobalData("eleventyComputed", {
    heroImage: (data) => {
      const pick = (m) => (!m ? null : m.video ? m.poster || null : m.src);
      if (data.media?.length) return pick(data.media[0]);
      if (data.media_middle?.length) return pick(data.media_middle[0]);
      if (data.media_left?.length) return pick(data.media_left[0]);
      const list =
        data.hero === "past"
          ? data.collections?.pastProjects
          : data.hero === "current"
            ? data.collections?.currentProjects
            : null;
      if (list?.length) {
        const d = list[0].data;
        return pick(d.media?.[0] || d.media_left?.[0] || d.media_middle?.[0]);
      }
      return null;
    },
  });

  // Render Markdown stored in front matter (bilingual body, venue/dates, about).
  const mdLib = new MarkdownIt({ html: true, breaks: true });
  eleventyConfig.addFilter("md", (value) => mdLib.render(String(value ?? "")));
  eleventyConfig.addFilter("mdInline", (value) => mdLib.renderInline(String(value ?? "")));

  // Responsive <picture> for a master filename in src/assets/images.
  // `priority` marks the LCP image (eager + high fetch priority).
  eleventyConfig.addShortcode(
    "picture",
    async (src, alt = "", priority = false, sizes = "(min-width: 900px) 66vw, 100vw") => {
      const metadata = await processImage(src, RESPONSIVE_WIDTHS);
      return Image.generateHTML(metadata, {
        alt,
        sizes,
        loading: priority ? "eager" : "lazy",
        decoding: priority ? "sync" : "async",
        fetchpriority: priority ? "high" : "low",
      });
    },
  );

  // Single URL (e.g. for a video poster or OG image). WebP is widely supported.
  eleventyConfig.addShortcode("imageUrl", async (src, width = 1200) => {
    const metadata = await processImage(src, [Number(width)]);
    const format = metadata.webp ? "webp" : "avif";
    return metadata[format][metadata[format].length - 1].url;
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

  // Collections driving the home page (current) and the projects index (past).
  const byOrder = (a, b) => (a.data.order ?? 0) - (b.data.order ?? 0);
  eleventyConfig.addCollection("currentProjects", (api) =>
    api
      .getFilteredByGlob("src/proyectos/*.md")
      .filter((item) => item.data.current === true)
      .sort(byOrder),
  );
  eleventyConfig.addCollection("pastProjects", (api) =>
    api
      .getFilteredByGlob("src/proyectos/*.md")
      .filter((item) => item.data.current !== true)
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
