/**
 * The site's asset folders and the formats each media type accepts.
 *
 * Content stores canonical root-relative paths (`/assets/images/…`) that the
 * site serves from the masters under `src/assets/`. This module is the one
 * place that knows those paths and formats: the content contract
 * (`lib/project-contract.js`), the view model (`lib/project-view.js`) and the
 * tests all read it. `.pages.yml` repeats them as literal YAML (the CMS reads
 * the file, not this module); the suite compares the two.
 */

/** Canonical paths content writes for each media source, as the site serves them. */
export const ASSET_URL = {
  images: "/assets/images",
  videos: "/assets/videos",
  documents: "/assets/files",
};

/** Master folders under `src/assets/` (see GLOSSARY: Media source). */
export const ASSET_FOLDER = {
  images: "images",
  videos: "videos",
  documents: "files",
};

/** Formats each media type may use, extension-less and lower-case. */
export const FORMATS = {
  image: ["webp", "jpg", "jpeg", "png", "avif", "gif"],
  video: ["mp4", "webm"],
  document: ["pdf"],
};

/**
 * How each gallery type is stored: the canonical path its `src` starts with,
 * the master folder, and the formats the pipeline can publish. Gallery types
 * only — documents are linked from rich text, never gallery items.
 */
export const GALLERY_TYPES = {
  image: { path: ASSET_URL.images, folder: ASSET_FOLDER.images, formats: FORMATS.image },
  video: { path: ASSET_URL.videos, folder: ASSET_FOLDER.videos, formats: FORMATS.video },
};
