/**
 * The routes the chrome links to (GLOSSARY: Site settings).
 *
 * The settings file stores a route key such as `about` next to each navigation
 * label, never a URL: the templates build the address from the key, so the path
 * segments stay in one place and the deployment path prefix applies to the link
 * like it does to every other URL the site owns.
 */

/**
 * Route key → route, as the site publishes it, inside one language tree. The
 * homepage is the tree's root (`/`, so the language prefix alone yields it — the
 * deployment's `/` and `/en/`), which is why it is a route here rather than
 * string-built by each template that links it.
 */
export const ROUTES = {
  home: "/",
  about: "/acerca-de/",
  projects: "/proyectos/",
};

/**
 * The route a navigation entry points at.
 *
 * @param {string} key the route key stored in the settings file
 * @returns {string} the root-relative route, ready for the `url` filter
 */
function routeUrl(key) {
  const route = ROUTES[key];
  if (route === undefined) {
    const known = Object.keys(ROUTES).join(", ");
    throw new Error(`unknown route key "${key}"; the site's routes are ${known}`);
  }
  return route;
}

/**
 * The route a navigation entry points at, inside one language tree.
 *
 * English mirrors the Spanish path segments (ADR-0002: `/en/proyectos/`, not
 * `/en/projects/`), so the address is the language's prefix plus the route —
 * `/proyectos/` in Spanish, `/en/proyectos/` in English, and the tree's root
 * (`/`, `/en/`) for the homepage.
 *
 * @param {string} key the route key stored in the settings file
 * @param {{prefix?: string}} [language] the language version the link belongs to
 * @returns {string} the root-relative route, ready for the `url` filter
 */
export function languageRouteUrl(key, language) {
  return `${language?.prefix ?? ""}${routeUrl(key)}`;
}
