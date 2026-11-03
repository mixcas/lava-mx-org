/**
 * Canonical project view model.
 *
 * One function turns a project's front matter into the model every project
 * surface renders: the project page, the homepage, and the archive page. It
 * normalizes the content so templates never see it raw:
 *
 * - the entry carries both language versions as objects (ADR-0002): the `es`
 *   object and an optional `en` one. Every value resolves for the language
 *   version being rendered, so templates never learn how the content stores it,
 * - media sources are the canonical asset paths the CMS writes
 *   (`/assets/images/…`, `/assets/videos/…`); the view model keeps the master's
 *   basename, which is what the image pipeline and the video element read,
 * - media items are typed (`image` / `video`) with the video playback flags,
 *   and an image's alt text resolves for the language version being rendered,
 * - the project text is the body of the language version being rendered
 *   (`text.body`), with the Spanish body where the English one is unwritten.
 *   `text.language` is the language that body is actually written in and
 *   `text.fallback` says whether it is a fallback, so a template can render it
 *   as Spanish on an English page. The other language's text never enters the
 *   model, so it can never reach the page,
 * - `fallback` records, per field, whether the value is the Spanish one standing
 *   in for an unwritten English value (ADR-0002).
 *
 * The build refuses content that breaks the contract (see
 * `lib/project-contract.js`), so this model reads one shape only: nothing here
 * tolerates pre-contract content.
 */

import path from "node:path";

import { DEFAULT_LANGUAGE, LANGUAGES, languageRoute } from "./languages.js";
import { GALLERY_TYPES } from "./media-assets.js";

/** Gallery media types; anything else reads as the first one (an image). */
const GALLERY_TYPE_NAMES = Object.keys(GALLERY_TYPES);
const DEFAULT_GALLERY_TYPE = GALLERY_TYPE_NAMES[0];

/** Media sources are canonical asset paths; the pipeline reads the basename. */
const basename = (value) => path.posix.basename(String(value ?? "").trim());

/** A written value: a non-blank string, trimmed. A blank one is no value. */
const written = (value) => (typeof value === "string" && value.trim() ? value.trim() : null);

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/**
 * The two language versions of a project's text fields.
 *
 * The content contract requires the `es` object and accepts an absent `en` one
 * (ADR-0002): an absent `en` object means the project is untranslated, and the
 * English version shows the Spanish values. The model stays total for the data
 * that is not a project (the sitemap, 404 and robots templates), which carries
 * neither object.
 */
function languageVersions(data) {
  return {
    es: isObject(data.es) ? data.es : {},
    en: isObject(data.en) ? data.en : {},
  };
}

/** The route prefix of each language, by code: `""` for Spanish, `/en`. */
const PREFIX_BY_CODE = Object.fromEntries(LANGUAGES.map((language) => [language.code, language.prefix]));

/**
 * The URL of one language version of a project.
 *
 * A project page is built at its own URL, so it already carries it. A
 * collection item carries the default (Spanish) one, and the language tree's
 * prefix turns it into the mirror (`/proyectos/x/` → `/en/proyectos/x/`), so a
 * listing in either language links to the counterpart project page.
 *
 * @param {object} data front matter of a project page or collection item
 * @param {string} language the language version whose URL is wanted
 * @returns {string|null} the root-relative URL, ready for the `url` filter
 */
function projectUrl(data, language) {
  const url = written(data.url) ?? written(data.page?.url);
  if (!url) return null;
  const { route } = languageRoute(url);
  return `${PREFIX_BY_CODE[language] ?? DEFAULT_LANGUAGE.prefix}${route}`;
}

/** One media item, normalized for rendering in one language version. */
function mediaItem(entry, { title, englishTitle, language }) {
  if (!entry) return null;

  const type = GALLERY_TYPE_NAMES.includes(entry.type) ? entry.type : DEFAULT_GALLERY_TYPE;

  if (type === "video") {
    return {
      type,
      src: basename(entry.src),
      poster: entry.poster ? basename(entry.poster) : null,
      autoplay: entry.autoplay === true,
      loop: entry.loop === true,
      mute: entry.mute === true,
    };
  }

  // Alt text resolves the language version's own alt, then that version's
  // project title, then the Spanish title (ADR-0002): an English page
  // describes an untranslated image in the project's English name when it has
  // one, and in the Spanish name otherwise. The flat `alt` key is
  // language-neutral, so it serves as either version's alt.
  const own = language === "en" ? written(entry.alt_en) : written(entry.alt_es);
  const alt = own ?? written(entry.alt) ?? (language === "en" ? englishTitle : title);
  return { type, src: basename(entry.src), alt: alt || title };
}

/**
 * Build the view model for one project.
 *
 * @param {object} data front matter of a project page or collection item
 * @param {"es"|"en"} [language] the language version being rendered; Spanish by
 *   default, since Spanish is the site's default version (ADR-0002). Everything
 *   that version says of itself resolves for it — its title, venue, dates, body
 *   and alt text — each falling back to Spanish when unwritten, and nothing of
 *   the other language version enters the model.
 * @returns {{
 *   url: string|null,
 *   language: string,
 *   title: string,
 *   venue: string|null,
 *   dates: string|null,
 *   text: { body: string, language: string, fallback: boolean },
 *   fallback: { title: boolean, venue: boolean, dates: boolean, text: boolean },
 *   variant: "standard"|"three-column",
 *   columns: number,
 *   gallery: Array<object>,
 *   splitAt: number|null,
 *   heroImage: string|null,
 * }}
 */
export function buildProjectView(data = {}, language = "es") {
  const versions = languageVersions(data);
  const spanish = versions.es;
  const english = versions.en;

  // Where an English value is absent the English version shows the Spanish one
  // silently (ADR-0002); the Spanish title is the project's last resort, since
  // alt text falls back to it.
  const title = written(spanish.title) ?? "";
  const englishTitle = written(english.title) ?? title;
  const own = language === "en" ? english : spanish;
  const resolved = (field) => written(own[field]) ?? written(spanish[field]);

  // The fields the English version may have to borrow from the Spanish one.
  // Spanish is the default version, so nothing is ever a fallback there.
  const isFallback = (field) => language !== DEFAULT_LANGUAGE.code && written(own[field]) === null;

  // The body is the language version's own text; an untranslated project shows
  // the Spanish body on its English page, marked as Spanish (`text.language`).
  const spanishText = written(spanish.text) ?? "";
  const ownText = written(own.text);
  const body = {
    body: ownText ?? spanishText,
    language: ownText === null ? DEFAULT_LANGUAGE.code : language,
    fallback: ownText === null && language !== DEFAULT_LANGUAGE.code,
  };

  const isThreeColumn = data.variant === "three-column";

  // One ordered gallery; the three-column layout splits it in half for display.
  const gallery = (Array.isArray(data.media) ? data.media : [])
    .map((entry) => mediaItem(entry, { title, englishTitle, language }))
    .filter(Boolean);

  // The three-column layout splits its one ordered gallery in half: the first
  // column takes the first half rounded up, the second column takes the rest.
  const splitAt = isThreeColumn ? Math.ceil(gallery.length / 2) : null;

  // Hero image for LCP and social metadata: the first media item, or a video's
  // poster. The three-column layout shares the image that heads its second
  // column — the slot its former middle gallery led — so existing links keep
  // pointing at the same media item.
  const hero = isThreeColumn ? (gallery[splitAt] ?? gallery[0]) : gallery[0];
  // A video is represented by its poster, an image by itself.
  const heroImage = !hero ? null : hero.type === "video" ? hero.poster : hero.src;

  return {
    url: projectUrl(data, language),
    language,
    title: language === "en" ? englishTitle : title,
    venue: resolved("venue"),
    dates: resolved("dates"),
    text: body,
    fallback: {
      title: isFallback("title"),
      venue: isFallback("venue"),
      dates: isFallback("dates"),
      text: body.fallback,
    },
    variant: isThreeColumn ? "three-column" : "standard",
    columns: Number(data.gallery_columns) || 1,
    gallery,
    splitAt,
    heroImage,
  };
}
