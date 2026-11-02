/**
 * Canonical project view model.
 *
 * One function turns a project's front matter into the model every project
 * surface renders: the project page, the homepage, and the archive page. It
 * normalizes the content so templates never see it raw:
 *
 * - media sources are the canonical asset paths the CMS writes
 *   (`/assets/images/…`, `/assets/videos/…`); the view model keeps the master's
 *   basename, which is what the image pipeline and the video element read,
 * - media items are typed (`image` / `video`) with the video playback flags,
 * - the project text: `text_es` is the Spanish text and is always present;
 *   `text_en` is the optional English text. The view model hands both through
 *   unchanged on `text` (`spanish` / `english`), and the template draws the
 *   divider between them.
 *
 * The build refuses content that breaks the contract (see
 * `lib/project-contract.js`), so this model reads the canonical shapes only:
 * nothing here tolerates pre-contract content.
 */

import path from "node:path";

/** Media sources are canonical asset paths; the pipeline reads the basename. */
const basename = (value) => path.posix.basename(String(value ?? "").trim());

/** The project text: Spanish is required content, English is optional. */
function projectText(data) {
  const english = String(data.text_en ?? "").trim();
  return { spanish: String(data.text_es ?? "").trim(), english: english || null };
}

/** One media item, normalized for rendering. */
function mediaItem(entry, title) {
  if (!entry) return null;

  if (entry.type === "video") {
    return {
      type: "video",
      src: basename(entry.src),
      poster: entry.poster ? basename(entry.poster) : null,
      autoplay: entry.autoplay === true,
      loop: entry.loop === true,
      mute: entry.mute === true,
    };
  }

  // Alt text falls back to the project title.
  return { type: "image", src: basename(entry.src), alt: entry.alt || title };
}

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
  const isThreeColumn = data.variant === "three-column";

  // One ordered gallery; the three-column layout splits it in half for display.
  const gallery = (Array.isArray(data.media) ? data.media : [])
    .map((entry) => mediaItem(entry, title))
    .filter(Boolean);

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
    text: projectText(data),
    variant: isThreeColumn ? "three-column" : "standard",
    columns: Number(data.gallery_columns) || 1,
    gallery,
    splitAt,
    heroImage,
  };
}
