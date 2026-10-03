/**
 * Eleventy configuration.
 * Docs: https://www.11ty.dev/docs/config/
 */
import path from "node:path";
import Image from "@11ty/eleventy-img";
import MarkdownIt from "markdown-it";

// `/` for a custom domain; `/<repo>/` when served from a GitHub Pages subpath.
const PATH_PREFIX = (process.env.PATH_PREFIX || "/").replace(/\/+$/, ""); // "" | "/repo"
const IMAGE_URL_PATH = `${PATH_PREFIX}/img/`; // "/img/" | "/repo/img/"
const IMAGES_DIR = path.join("src", "assets", "images");
const RESPONSIVE_WIDTHS = [480, 960, 1440, 2000];

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
    sharpWebpOptions: { quality: 78 },
    sharpAvifOptions: { quality: 58 },
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

  // Render Markdown stored in front matter (bilingual body, venue/dates, about).
  const mdLib = new MarkdownIt({ html: true, breaks: true });
  eleventyConfig.addFilter("md", (value) => mdLib.render(String(value ?? "")));
  eleventyConfig.addFilter("mdInline", (value) => mdLib.renderInline(String(value ?? "")));

  // Responsive <picture> for a master filename in src/assets/images.
  eleventyConfig.addShortcode(
    "picture",
    async (src, alt = "", sizes = "(min-width: 900px) 66vw, 100vw") => {
      const metadata = await processImage(src, RESPONSIVE_WIDTHS);
      return Image.generateHTML(metadata, {
        alt,
        sizes,
        loading: "lazy",
        decoding: "async",
      });
    },
  );

  // Single URL (e.g. for a video poster).
  eleventyConfig.addShortcode("imageUrl", async (src, width = 1200) => {
    const metadata = await processImage(src, [Number(width)]);
    const format = metadata.avif ? "avif" : "webp";
    return metadata[format][metadata[format].length - 1].url;
  });

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
