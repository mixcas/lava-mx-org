/**
 * Deployment path prefix for root-relative local URLs.
 *
 * Content stores canonical root-relative local asset links
 * (`[Dossier](/assets/files/Dossier.pdf)`) so the same Markdown works on the
 * custom domain and under a GitHub Pages subpath. Templates get the prefix from
 * Eleventy's `url` filter; Markdown-rendered front matter does not, so rendered
 * HTML passes through this rewriter instead — one place that knows which URLs
 * the site owns.
 */

/** Absolute URLs (`https://…`), protocol-relative ones (`//host`), and non-web
 *  schemes (`mailto:`, `tel:`) are not the site's to prefix. */
const hasScheme = (url) => /^[a-z][a-z0-9+.-]*:/i.test(url);

/** A URL to leave alone: external, protocol-relative, in-page, or not root-relative. */
const isForeignUrl = (url) => !url.startsWith("/") || url.startsWith("//") || hasScheme(url);

/**
 * Apply a deployment path prefix (`""` for the root domain, `"/repo"` for a
 * subpath) to one URL. Root-relative local URLs gain the prefix exactly once;
 * every other URL comes back byte-identical.
 */
export function withPathPrefix(url, prefix = "") {
  if (!prefix || isForeignUrl(url)) return url;
  // Already carrying this prefix: never double it.
  if (url === prefix || url.startsWith(`${prefix}/`)) return url;
  return `${prefix}${url}`;
}

/**
 * Rewrite the `href` and `src` attributes of rendered HTML to the deployment
 * path prefix. Only local root-relative URLs change; external links, `mailto:`
 * and `tel:` links, in-page `#…` links, and already-prefixed URLs are untouched.
 */
export function applyPathPrefix(html, prefix = "") {
  if (!prefix) return html;
  return String(html ?? "").replace(/(?<![-\w])(href|src)="([^"]*)"/g, (_match, name, url) => `${name}="${withPathPrefix(url, prefix)}"`);
}
