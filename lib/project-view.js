/**
 * Canonical project view model.
 *
 * One function turns a project's front matter into the model every project
 * surface renders: the project page, the homepage, and the archive page. It
 * normalizes the content so templates never see it raw:
 *
 * - the entry may be written in either of the two content shapes (ADR-0002):
 *   the flat keys of today's content (`title`, `venue`, `dates`, `text_es`,
 *   `text_en`) or the two language objects (`es` and an optional `en`). Both
 *   resolve to the same values, so templates never learn which shape the
 *   content uses,
 * - media sources are the canonical asset paths the CMS writes
 *   (`/assets/images/…`, `/assets/videos/…`); the view model keeps the master's
 *   basename, which is what the image pipeline and the video element read,
 * - media items are typed (`image` / `video`) with the video playback flags,
 *   and an image's alt text resolves for the language version being rendered,
 * - the project text: the Spanish body is always present, the English one only
 *   when the content writes it. The view model hands both through on `text`
 *   (`spanish` / `english`), and the template draws the divider between them.
 *
 * The build refuses content that breaks the contract (see
 * `lib/project-contract.js`), so this model reads the content shapes only:
 * nothing here tolerates pre-contract content.
 */

import path from "node:path";

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
 * The two language versions of a project's text fields, whichever shape the
 * entry uses.
 *
 * The flat keys are language-neutral: `title`, `venue` and `dates` name the
 * work in both versions, and `text_es` / `text_en` are its two bodies. The
 * nested shape splits each of them, and an absent `en` object means the
 * project is untranslated.
 */
function languageVersions(data) {
  if (!isObject(data.es)) {
    const shared = { title: data.title, venue: data.venue, dates: data.dates };
    return { es: { ...shared, text: data.text_es }, en: { ...shared, text: data.text_en } };
  }
  return { es: data.es, en: isObject(data.en) ? data.en : {} };
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
 *   default, since Spanish is the site's default version (ADR-0002). Only what
 *   that version says of itself changes — its title, venue, dates and alt text,
 *   each falling back to Spanish when unwritten. The body pair stays as the
 *   stacked Spanish page draws it; the English page's own body arrives with the
 *   routing.
 * @returns {{
 *   url: string|null,
 *   title: string,
 *   venue: string|null,
 *   dates: string|null,
 *   text: { spanish: string, english: string|null },
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
    url: data.url ?? data.page?.url ?? null,
    title: language === "en" ? englishTitle : title,
    venue: resolved("venue"),
    dates: resolved("dates"),
    text: {
      spanish: written(spanish.text) ?? "",
      // No fallback here: an untranslated project has no English body at all,
      // and the template draws the divider only when there is one.
      english: written(english.text),
    },
    variant: isThreeColumn ? "three-column" : "standard",
    columns: Number(data.gallery_columns) || 1,
    gallery,
    splitAt,
    heroImage,
  };
}
