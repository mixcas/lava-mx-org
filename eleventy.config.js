/**
 * Eleventy configuration.
 * Docs: https://www.11ty.dev/docs/config/
 */
export default function (eleventyConfig) {
  // Static assets are copied verbatim. Images are processed separately via
  // @11ty/eleventy-img shortcodes (Phase 2).
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    // `/` for a custom domain; `/<repo-name>/` when served from a GitHub Pages
    // project subpath. Set via PATH_PREFIX at build time.
    pathPrefix: process.env.PATH_PREFIX || "/",
    templateFormats: ["njk", "md", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk",
  };
}
