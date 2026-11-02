/**
 * Canonical project view model.
 *
 * One function turns a project's raw front matter into the model every project
 * surface renders: the project page, the homepage, and the archive page. It
 * interprets today's legacy content so templates never see it:
 *
 * - bare media filenames (also accepts the canonical paths the edited content
 *   model will store; both normalize to a basename),
 * - `video: true` items with `poster` / `autoplay` / `loop` / `muted`,
 * - the separate `media_left` / `media_middle` galleries of the three-column
 *   variant (merged into one gallery, left column first, with `splitAt` marking
 *   where the second column starts),
 * - the literal `//` bilingual separator inside `text`.
 *
 * The output shape is the target content model (see the migration spec):
 * typed media items (`type`, `src`, `alt`, `poster`, `autoplay`, `loop`,
 * `mute`) and separate Spanish/English text. When content adopts those fields,
 * only this module changes.
 */

import path from "node:path";

/** A `//` line inside project text separates Spanish text from English text. */
const BILINGUAL_SEPARATOR = /^[ \t]*\/\/[ \t]*$/m;

/** Media sources may be bare filenames or canonical paths; render the basename. */
const basename = (value) => path.basename(String(value ?? "").trim());

/** Split legacy bilingual text at the first `//` line. */
function projectText(raw) {
  const text = String(raw ?? "");
  const separator = text.match(BILINGUAL_SEPARATOR);
  if (!separator || separator.index === undefined) return { spanish: text, english: null };

  return {
    spanish: text.slice(0, separator.index).trimEnd(),
    english: text.slice(separator.index + separator[0].length).trimStart() || null,
  };
}

/** Normalize one legacy or target media item. */
function mediaItem(entry, title) {
  if (!entry) return null;

  if (entry.type === "video" || entry.video === true) {
    return {
      type: "video",
      src: basename(entry.src),
      poster: entry.poster ? basename(entry.poster) : null,
      autoplay: entry.autoplay === true,
      loop: entry.loop === true,
      mute: entry.muted === true || entry.mute === true,
    };
  }

  // Alt text falls back to the project title.
  return { type: "image", src: basename(entry.src), alt: entry.alt || title };
}

const mediaList = (entries, title) => (entries ?? []).map((entry) => mediaItem(entry, title)).filter(Boolean);

/** The still image that represents a media item (a video uses its poster). */
const heroOf = (item) => (!item ? null : item.type === "video" ? item.poster : item.src);

/**
 * Build the view model for one project.
 *
 * @param {object} data front matter of a project page or collection item
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
export function buildProjectView(data = {}) {
  const title = data.title ?? "";
  const single = mediaList(data.media, title);
  // Legacy tolerance (removed in a later ticket): the three-column variant used
  // to keep two separate galleries; they merge into one, left column first.
  const left = mediaList(data.media_left, title);
  const middle = mediaList(data.media_middle, title);
  const isThreeColumn = data.variant === "three-column";

  const gallery = isThreeColumn ? [...left, ...middle, ...single] : single;

  // The three-column layout splits its one ordered gallery in half: the first
  // column takes the first half rounded up, the second column takes the rest.
  const splitAt = isThreeColumn ? Math.ceil(gallery.length / 2) : null;

  // Hero image for LCP and social metadata: the first media item. The
  // three-column layout shares the image that heads its second column — the
  // slot its former middle gallery led — so existing links keep pointing at the
  // same media item.
  const heroImage = heroOf(isThreeColumn ? (gallery[splitAt] ?? gallery[0]) : gallery[0]);

  return {
    url: data.url ?? data.page?.url ?? null,
    title,
    venue: data.venue ?? null,
    dates: data.dates ?? null,
    text: projectText(data.text),
    variant: isThreeColumn ? "three-column" : "standard",
    columns: Number(data.gallery_columns) || 1,
    gallery,
    splitAt,
    heroImage,
  };
}
