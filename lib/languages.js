/**
 * The site's languages, and the route registry the chrome and the metadata
 * read (ADR-0002: one page per language version, Spanish at the root).
 *
 * `src/_data/languages.json` is the single source of what a language version
 * is: its route prefix, its HTML language code, its Open Graph locale, and the
 * name it goes by in its own language (the counterpart page's link text). Every
 * other place — this module, the `languages` global data, the templates — reads
 * that file, so adding a third language is adding an entry there and nothing
 * else names a code. The chrome text itself lives in the site settings, per
 * language (`site[<language code>].…`).
 *
 * Two derived facts make the rest of the site language-generic without anyone
 * maintaining a list of what exists in which language:
 *
 * - a *route* is a URL without its language prefix, so `/proyectos/` and
 *   `/en/proyectos/` are the same route;
 * - the *language registry* maps each route to the language versions Eleventy
 *   actually built. It is derived from the built pages (the `languageRoutes`
 *   collection), never from a hand-written list, so a page that gains a
 *   language version gains its hreflang, its alternate locale and its language
 *   link in the same build.
 */

import fs from "node:fs";

/** The declared languages, in the order the site lists them (Spanish first). */
export const LANGUAGES = JSON.parse(fs.readFileSync(new URL("../src/_data/languages.json", import.meta.url), "utf8"));

/** Spanish is the language at the root of the site; `x-default` points at it. */
export const DEFAULT_LANGUAGE = LANGUAGES.find((language) => language.prefix === "") ?? LANGUAGES[0];

/** Longest prefix first, so `/en/…` is never mistaken for a Spanish route. */
const BY_LONGEST_PREFIX = [...LANGUAGES].sort((a, b) => b.prefix.length - a.prefix.length);

/**
 * The language a page URL belongs to, and the route it is a version of.
 *
 * @param {string} url a page URL as Eleventy writes it, without the deployment
 *   path prefix (`/`, `/en/`, `/en/proyectos/penumbra/`)
 * @returns {{ language: object, route: string }} the language whose tree the URL
 *   is in, and the URL without that language's prefix (`/`)
 */
export function languageRoute(url) {
  const value = String(url ?? "");
  const language =
    BY_LONGEST_PREFIX.find((candidate) => value === candidate.prefix || value.startsWith(`${candidate.prefix}/`)) ??
    DEFAULT_LANGUAGE;
  return { language, route: value.slice(language.prefix.length) || "/" };
}

/**
 * The language registry: every built route, and the URL each language version
 * of it was built at.
 *
 * Built from the pages Eleventy produced (their `url`), so it can only ever
 * advertise pages that exist.
 *
 * @param {Array<{url?: string}>} pages the collection of built pages
 * @returns {Array<{route: string, versions: Record<string, string>}>}
 */
export function languageRoutes(pages = []) {
  const routes = new Map();
  for (const page of pages) {
    if (!page?.url) continue;
    const { language, route } = languageRoute(page.url);
    const entry = routes.get(route) ?? { route, versions: {} };
    entry.versions[language.code] = page.url;
    routes.set(route, entry);
  }
  return [...routes.values()];
}

/**
 * What one page needs to know about its other language versions: its own
 * language, the counterpart page to link to, and the hreflang set.
 *
 * Alternates are advertised only for a route built in more than one language —
 * a page that exists in Spanish alone carries no hreflang and no language link,
 * so nothing ever points at a page that is not built. `x-default` is the
 * Spanish URL (ADR-0002).
 *
 * @param {string} url the page's URL, without the deployment path prefix
 * @param {Array<{route: string, versions: Record<string, string>}>} routes the
 *   language registry
 * @returns {{
 *   language: object,
 *   route: string,
 *   counterpart: {code: string, label: string, locale: string, url: string}|null,
 *   alternates: Array<{hreflang: string, url: string}>,
 * }}
 */
export function languageAlternates(url, routes = []) {
  const { language, route } = languageRoute(url);
  const versions = routes.find((entry) => entry.route === route)?.versions ?? {};
  const built = LANGUAGES.filter((entry) => versions[entry.code]);
  const other = LANGUAGES.find((entry) => entry.code !== language.code && versions[entry.code]);

  return {
    language,
    route,
    counterpart: other
      ? { code: other.code, label: other.label, locale: other.locale, url: versions[other.code] }
      : null,
    alternates:
      built.length > 1
        ? [
            ...built.map((entry) => ({ hreflang: entry.code, url: versions[entry.code] })),
            { hreflang: "x-default", url: versions[DEFAULT_LANGUAGE.code] ?? versions[built[0].code] },
          ]
        : [],
  };
}

/**
 * The sitemap's entries: one per built language version of every route, each
 * carrying the hreflang alternates of the languages that route exists in.
 *
 * @param {Array<{route: string, versions: Record<string, string>}>} routes the
 *   language registry
 * @returns {Array<{url: string, alternates: Array<{hreflang: string, url: string}>}>}
 */
export function sitemapEntries(routes = []) {
  return routes.flatMap((entry) =>
    LANGUAGES.filter((declared) => entry.versions[declared.code]).map((declared) => ({
      url: entry.versions[declared.code],
      alternates: languageAlternates(entry.versions[declared.code], routes).alternates,
    })),
  );
}

/**
 * Whether an editor wrote a value: a string with something in it.
 *
 * This is the one spelling of the Untranslated-field rule (GLOSSARY, ADR-0002)
 * — a value that is present must be non-blank — so the content contract, the
 * view model and the tracker cannot disagree about what "written" means. An
 * absent value and a blank one are the same thing: unwritten.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isWritten(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * One field of a page's language version, with the Untranslated field rule
 * (GLOSSARY, ADR-0002): the value written for that language when it is present
 * and not blank, otherwise the Spanish one, silently.
 *
 * The English object is optional at every level, and the CMS deletes a field
 * an editor clears, so `{ es }` with no `en` at all — or an `en` missing this
 * one field — is a legal state that must still yield a complete page. Spanish
 * is the required version, so it is also what every other language falls back
 * to. A Spanish value that is absent too reads as "" — the page renders without
 * that block rather than failing the build (the content contract is what names
 * required Spanish content for a Project).
 *
 * @param {Record<string, Record<string, unknown>>} versions the page's language
 *   objects, e.g. `{ es, en }`, where any language but Spanish may be absent
 * @param {string} code the code of the language version being rendered
 * @param {string} field the field name inside those language objects
 * @returns {string} the value that language version shows for the field
 */
export function localizedText(versions, code, field) {
  const own = versions?.[code]?.[field];
  const fallback = versions?.[DEFAULT_LANGUAGE.code]?.[field];
  return isWritten(own) ? own : isWritten(fallback) ? fallback : "";
}
