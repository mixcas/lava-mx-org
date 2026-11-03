/**
 * Project content contract.
 *
 * The front matter of every Project (GLOSSARY: an entry under
 * `src/proyectos/`) is checked before Eleventy renders anything: invalid
 * content fails the build with a message naming the project file and the
 * field, instead of producing a page with a missing title or a broken gallery.
 *
 * The rules mirror `.pages.yml` (what the CMS is allowed to write) and the
 * Media item model read by `lib/project-view.js`. Gallery items are numbered
 * from 1, as an editor counts them.
 *
 * A Project may be written in either content shape (ADR-0002): today's flat
 * keys, or the `es` / `en` objects that replace them. Both are accepted while
 * the content migration runs; the two-language rules arrive with it.
 */

import fs from "node:fs";
import path from "node:path";

import { parseFrontMatter } from "./front-matter.js";
import { GALLERY_TYPES } from "./media-assets.js";

/** Where projects live, relative to the Eleventy input directory. */
const PROJECT_DIR = "proyectos";

/** Eleventy directory data shared by every project file. */
const DEFAULTS_FILE = "proyectos.11tydata.json";

/** The layout variants the templates render. */
const VARIANTS = ["standard", "three-column"];

/** The gallery column counts a project may declare. */
const COLUMN_COUNTS = [1, 2];

/** The video playback flags, all booleans. */
const VIDEO_FLAGS = ["autoplay", "loop", "mute"];

/** Legacy project keys, and what replaced each one. */
export const LEGACY_KEYS = {
  current: 'use "featured"',
  slug: "the URL comes from the file name",
  layout: "the layout comes from proyectos.11tydata.json",
  text: 'use "text_es" (and optionally "text_en")',
  bio: 'use "text_es" (and optionally "text_en")',
  media_left: 'use one ordered "media" list',
  media_middle: 'use one ordered "media" list',
};

/** Legacy media item keys, and what replaced each one. */
const LEGACY_ITEM_KEYS = {
  video: 'use "type: video"',
  muted: 'use "mute"',
};

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** The text fields one language version carries (ADR-0002). */
const LANGUAGE_FIELDS = ["title", "venue", "dates", "text"];

/** A project written with the language objects rather than the flat keys. */
const usesLanguageObjects = (data) => Object.hasOwn(data, "es") || Object.hasOwn(data, "en");

/** Render a value in an error message. */
const show = (value) => (value === undefined ? "nothing" : JSON.stringify(value));

/** "webp, jpg or png". */
const listFormats = (formats) => formats.join(", ").replace(/, ([^,]*)$/, " or $1");

/**
 * Path as an editor sees it: rooted at the Eleventy input directory.
 * `…/src/proyectos/penumbra.md` becomes `src/proyectos/penumbra.md`.
 */
const display = (inputDir, file) =>
  path.posix.join(path.basename(inputDir), path.relative(inputDir, file).split(path.sep).join("/"));

/** A file's parsed YAML front matter, or a message describing why there is none. */
const frontMatter = (file) => parseFrontMatter(fs.readFileSync(file, "utf8"));

/** The directory defaults every project inherits. */
function directoryDefaults(projectDir) {
  const file = path.join(projectDir, DEFAULTS_FILE);
  if (!fs.existsSync(file)) return { error: "the project directory defaults file is missing" };
  try {
    return { data: JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch (error) {
    return { error: `the project directory defaults are not valid JSON (${error.message})` };
  }
}

/**
 * Check a media source (or a video poster) against its type's folder, formats
 * and masters.
 *
 * @param {string} value the path written in the content
 * @param {"image"|"video"} type
 * @param {string} field the field, as the message names it (`"src"`, `"poster"`)
 * @param {{ assetsDir: string, inputDir: string }} context
 * @returns {string[]} problems, phrased to follow the field
 */
function checkSource(value, type, field, { assetsDir, inputDir }) {
  const spec = GALLERY_TYPES[type];
  const source = String(value).trim();
  if (!source.startsWith(`${spec.path}/`)) {
    return [`${field} must be a path under ${spec.path}/`];
  }

  const extension = path.posix.extname(source).toLowerCase();
  if (!spec.formats.includes(extension.slice(1))) {
    // A wrong extension usually means a wrong file: report the format alone.
    return [`${field} has an unsupported ${type} format "${extension}"; use ${listFormats(spec.formats)}`];
  }

  // The image pipeline reads the master's basename; a missing master would
  // otherwise surface as a crash deep in the build.
  const master = path.join(assetsDir, spec.folder, path.posix.basename(source));
  if (!fs.existsSync(master)) {
    return [`the master ${display(inputDir, master)} does not exist`];
  }
  return [];
}

/** Check one gallery item; `index` is 1-based, as an editor counts them. */
function checkMediaItem(item, index, context) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return [`media[${index}] must be a media item with "type" and "src"`];
  }

  const source = typeof item.src === "string" ? item.src.trim() : "";
  const label = source ? `media[${index}] ("${source}")` : `media[${index}]`;
  const errors = [];
  const type = Object.hasOwn(GALLERY_TYPES, item.type ?? "") ? item.type : null;

  // A legacy `video: true` item is reported once, with its fix, below.
  if (!type && !Object.hasOwn(item, "video")) {
    errors.push(`${label}: "type" must be "image" or "video" (found: ${show(item.type)})`);
  }
  for (const [key, hint] of Object.entries(LEGACY_ITEM_KEYS)) {
    if (Object.hasOwn(item, key)) errors.push(`${label}: the legacy "${key}" key is gone; ${hint}`);
  }

  if (!source) {
    errors.push(`${label}: "src" is required`);
  } else if (type) {
    errors.push(...checkSource(source, type, '"src"', context).map((error) => `${label}: ${error}`));
  }

  if (type === "video") {
    if (isNonEmptyString(item.poster)) {
      errors.push(...checkSource(item.poster, "image", '"poster"', context).map((error) => `${label}: ${error}`));
    } else if (item.poster != null && item.poster !== "") {
      errors.push(`${label}: "poster" must be a path under ${GALLERY_TYPES.image.path}/`);
    }
    for (const flag of VIDEO_FLAGS) {
      if (flag in item && typeof item[flag] !== "boolean") {
        errors.push(`${label}: "${flag}" must be true or false (found: ${show(item[flag])})`);
      }
    }
  }

  // Alt text is optional, but when present it is text the template renders.
  // A media item carries one language-neutral `alt` or, in the two-language
  // content model, one alt per language.
  for (const field of ["alt", "alt_es", "alt_en"]) {
    if (item[field] != null && typeof item[field] !== "string") {
      errors.push(`${label}: "${field}" must be a string (found: ${show(item[field])})`);
    }
  }

  return errors;
}

/** Check the gallery of one project. */
function checkGallery(media, context) {
  if (media == null) return [];
  if (!Array.isArray(media)) return ['"media" must be a list of media items'];
  return media.flatMap((item, index) => checkMediaItem(item, index + 1, context));
}

/**
 * Check the `es` / `en` objects of one project (ADR-0002).
 *
 * The Spanish object is the required content — a title and a body — with venue
 * and dates optional, as the flat keys are today. The English object is
 * optional at every level: an unwritten value shows the Spanish one instead.
 * Every written value is text, because every written value is rendered.
 */
function checkLanguageObjects(project) {
  const errors = [];

  if (!isObject(project.es)) {
    errors.push(`"es" must be an object with "title" and "text" (found: ${show(project.es)})`);
  } else {
    if (!isNonEmptyString(project.es.title)) {
      errors.push('"es.title" is required and must be a non-empty string');
    }
    if (!isNonEmptyString(project.es.text)) {
      errors.push('"es.text" is required and must be a non-empty string');
    }
  }
  if (project.en != null && !isObject(project.en)) {
    errors.push(`"en" must be an object with "title", "venue", "dates" and "text" (found: ${show(project.en)})`);
  }

  for (const [language, version] of [
    ["es", project.es],
    ["en", project.en],
  ]) {
    if (!isObject(version)) continue;
    for (const field of LANGUAGE_FIELDS) {
      if (version[field] != null && typeof version[field] !== "string") {
        errors.push(`"${language}.${field}" must be a string (found: ${show(version[field])})`);
      }
    }
  }

  return errors;
}

/**
 * Check one project's front matter; returns the problems, each naming a field.
 *
 * @param {object} data the project file's own front matter
 * @param {object} defaults the directory defaults it inherits
 * @param {{ assetsDir: string, inputDir: string }} context
 */
function checkProject(data, defaults, context) {
  const errors = [];
  const project = { ...defaults, ...data };

  // The project file carries only what an editor sets: the developer-only keys
  // and the pre-CMS spellings are leftovers the templates no longer interpret.
  for (const [key, hint] of Object.entries(LEGACY_KEYS)) {
    if (Object.hasOwn(data, key)) errors.push(`the legacy "${key}" key is not part of a project; ${hint}`);
  }

  // Both content shapes are accepted while the content migration runs: today's
  // flat keys and the two language objects that replace them (ADR-0002).
  if (usesLanguageObjects(project)) {
    errors.push(...checkLanguageObjects(project));
  } else {
    if (!isNonEmptyString(project.title)) {
      errors.push('"title" is required and must be a non-empty string');
    }
    if (!isNonEmptyString(project.text_es)) {
      errors.push('"text_es" is required and must be a non-empty string');
    }
  }
  if (typeof project.order !== "number" || !Number.isFinite(project.order)) {
    errors.push(`"order" must be a number (found: ${show(project.order)})`);
  }
  if (typeof project.featured !== "boolean") {
    errors.push(`"featured" must be true or false (found: ${show(project.featured)})`);
  }
  if (!COLUMN_COUNTS.includes(project.gallery_columns)) {
    errors.push(`"gallery_columns" must be 1 or 2 (found: ${show(project.gallery_columns)})`);
  }
  if (!VARIANTS.includes(project.variant)) {
    errors.push(`"variant" must be "standard" or "three-column" (found: ${show(project.variant)})`);
  }

  errors.push(...checkGallery(project.media, context));

  return errors;
}

/**
 * Every problem with the project content under an Eleventy input directory.
 *
 * @param {{ inputDir: string }} options
 * @returns {string[]} messages, each prefixed with the project file it belongs to
 */
export function checkProjects({ inputDir }) {
  const projectDir = path.join(inputDir, PROJECT_DIR);
  if (!fs.existsSync(projectDir)) return [];

  // Every project inherits the directory defaults; without them no project can
  // be judged complete, so the missing defaults file is the problem to report.
  const defaults = directoryDefaults(projectDir);
  if (defaults.error) {
    return [`${display(inputDir, path.join(projectDir, DEFAULTS_FILE))}: ${defaults.error}`];
  }

  // Media masters are resolved next to the content, so the same check runs for
  // the site and for a throwaway content directory in the tests.
  const context = { inputDir, assetsDir: path.join(inputDir, "assets") };
  const errors = [];

  const files = fs
    .readdirSync(projectDir)
    .filter((name) => name.endsWith(".md"))
    .sort();

  for (const name of files) {
    const file = path.join(projectDir, name);
    const label = display(inputDir, file);
    const front = frontMatter(file);
    if (front.error) {
      errors.push(`${label}: ${front.error}`);
      continue;
    }
    for (const message of checkProject(front.data, defaults.data, context)) {
      errors.push(`${label}: ${message}`);
    }
  }

  return errors;
}

/**
 * Fail the build when any project breaks the contract.
 *
 * @param {{ inputDir: string }} options
 */
export function assertProjectsValid({ inputDir }) {
  const errors = checkProjects({ inputDir });
  if (!errors.length) return;

  const problem = errors.length === 1 ? "problem" : "problems";
  throw new Error(
    [
      `Invalid project content (${errors.length} ${problem}):`,
      ...errors.map((error) => `  - ${error}`),
      `Fix the front matter under ${display(inputDir, path.join(inputDir, PROJECT_DIR))}/ (.pages.yml describes each field).`,
    ].join("\n"),
  );
}
