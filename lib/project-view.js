/**
 * Canonical project view model.
 *
 * One function turns a project's front matter into the model every project
 * surface renders: the project page, the homepage, and the archive page. It
 * normalizes the content so templates never see it raw:
 *
 * - the entry carries its language versions as objects (ADR-0002): the `es`
 *   object and an optional `en` one, and every value resolves for the language
 *   version being rendered, so templates never learn how the content stores it.
 *   The codes, their order and the fallback language come from
 *   `src/_data/languages.json`, so nothing here names a language: a third one
 *   is a third entry there,
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
 * - `fallback` records, per field, whether the value is the default language's
 *   standing in for an unwritten value in the language being rendered
 *   (ADR-0002).
 *
 * The build refuses content that breaks the contract (see
 * `lib/project-contract.js`), so this model reads one shape only: nothing here
 * tolerates pre-contract content.
 */

import path from "node:path";

import { DEFAULT_LANGUAGE, LANGUAGES, isWritten, languageRoute } from "./languages.js";
import { GALLERY_TYPES } from "./media-assets.js";

/** Gallery media types; anything else reads as the first one (an image). */
const GALLERY_TYPE_NAMES = Object.keys(GALLERY_TYPES);
const DEFAULT_GALLERY_TYPE = GALLERY_TYPE_NAMES[0];

/** Media sources are canonical asset paths; the pipeline reads the basename. */
const basename = (value) => path.posix.basename(String(value ?? "").trim());

/** A written value, trimmed; anything unwritten (blank included) is null. */
const written = (value) => (isWritten(value) ? value.trim() : null);

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/**
 * The language versions of a project's text fields, keyed by language code.
 *
 * The content contract requires the `es` object and accepts an absent `en` one
 * (ADR-0002): an absent `en` object means the project is untranslated, and the
 * English version shows the Spanish values. The model stays total for the data
 * that is not a project (the sitemap, 404 and robots templates), which carries
 * no language object at all.
 */
function languageVersions(data) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [language.code, isObject(data[language.code]) ? data[language.code] : {}]),
  );
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
function mediaItem(entry, { title, language }) {
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

  // Alt text resolves the language version's own alt (`alt_<code>`), then that
  // version's project title, which already falls back to the Spanish title
  // (ADR-0002): an English page describes an untranslated image in the
  // project's English name when it has one, and in the Spanish name otherwise.
  // A third language needs no change here: its code names its own alt key, and
  // its title comes from the same resolution.
  const alt = written(entry[`alt_${language}`]) ?? title;
  return { type, src: basename(entry.src), alt };
}

/**
 * Build the view model for one project.
 *
 * @param {object} data front matter of a project page or collection item
 * @param {string} [language] the code of the language version being rendered;
 *   the default language (Spanish) by default, since that is the site's default
 *   version (ADR-0002). Everything that version says of itself resolves for it —
 *   its title, venue, dates, body and alt text — each falling back to Spanish
 *   when unwritten, and nothing of the other language version enters the model.
 *   Nothing here names a language: the codes, their order and their fallback
 *   come from `src/_data/languages.json`, so a third language is a third entry
 *   there and this model needs no change.
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
export function buildProjectView(data = {}, language = DEFAULT_LANGUAGE.code) {
  const versions = languageVersions(data);
  const spanish = versions[DEFAULT_LANGUAGE.code];
  const own = versions[language] ?? spanish;

  // Where a value is absent for this language, its version shows the Spanish
  // one silently (ADR-0002). The title resolves that way too, and alt text
  // falls back along the title's own chain, so this is the one title per
  // language version that everything reading a title sees.
  const resolved = (field) => written(own[field]) ?? written(spanish[field]);
  const titleIn = (code) => written(versions[code]?.title) ?? written(spanish.title) ?? "";

  // The fields the English version may have to borrow from the Spanish one.
  // Spanish is the default version, so nothing is ever a fallback there.
  const isFallback = (field) => language !== DEFAULT_LANGUAGE.code && !isWritten(own[field]);

  // The body is the language version's own text; an untranslated project shows
  // the Spanish body on its English page, marked as Spanish (`text.language`).
  const ownText = written(own.text);
  const body = {
    body: ownText ?? written(spanish.text) ?? "",
    language: ownText === null ? DEFAULT_LANGUAGE.code : language,
    fallback: ownText === null && language !== DEFAULT_LANGUAGE.code,
  };

  const isThreeColumn = data.variant === "three-column";

  // One ordered gallery; the three-column layout splits it in half for display.
  const gallery = (Array.isArray(data.media) ? data.media : [])
    .map((entry) => mediaItem(entry, { title: titleIn(language), language }))
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
    title: titleIn(language),
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
