/**
 * Project content contract.
 *
 * The front matter of every Project (GLOSSARY: an entry under
 * `src/proyectos/`) is checked before Eleventy renders anything: invalid
 * content fails the build with a message naming the project file and the
 * field, instead of producing a page with a missing title or a broken gallery.
 *
 * The rules mirror `.pages.yml` (what the CMS is allowed to write) and the
 * Media item model read by `lib/project-view.js`.
 */

import fs from "node:fs";
import path from "node:path";

import yaml from "js-yaml";

/** Where projects live, relative to the Eleventy input directory. */
const PROJECT_DIR = "proyectos";

/** Eleventy directory data shared by every project file. */
const DEFAULTS_FILE = "proyectos.11tydata.json";

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

/** Render a value in an error message. */
const show = (value) => (value === undefined ? "nothing" : JSON.stringify(value));

/**
 * Path as an editor sees it: rooted at the Eleventy input directory.
 * `…/src/proyectos/penumbra.md` becomes `src/proyectos/penumbra.md`.
 */
const display = (inputDir, file) => path.posix.join(path.basename(inputDir), path.relative(inputDir, file).split(path.sep).join("/"));

/** A file's parsed YAML front matter, or a message describing why there is none. */
function frontMatter(file) {
  const source = fs.readFileSync(file, "utf8");
  const body = source.replace(/^---[ \t]*\r?\n/, "");
  const end = body.search(/^---[ \t]*\r?$/m);
  if (body === source || end === -1) {
    return { error: "the file has no YAML front matter" };
  }
  try {
    return { data: yaml.load(body.slice(0, end)) ?? {} };
  } catch (error) {
    return { error: `the front matter is not valid YAML (${error.message.split("\n")[0]})` };
  }
}

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

/** The gallery column counts a project may declare. */
const COLUMN_COUNTS = [1, 2];

/** The layout variants the templates render. */
const VARIANTS = ["standard", "three-column"];

/** How each media type is stored: its folder, its masters folder, its formats. */
const MEDIA = {
  image: { folder: "/assets/images", folderName: "images", formats: ["webp", "jpg", "jpeg", "png", "avif", "gif"] },
  video: { folder: "/assets/videos", folderName: "videos", formats: ["mp4", "webm"] },
};

/** Legacy media item keys, and what replaced each one. */
const LEGACY_ITEM_KEYS = {
  video: 'use "type: video"',
  muted: 'use "mute"',
};

/** "webp, jpg or png". */
const listFormats = (formats) => formats.join(", ").replace(/, ([^,]*)$/, " or $1");

/** Legacy project keys, and what replaced each one. */
const LEGACY_KEYS = {
  current: 'use "featured"',
  slug: "the URL comes from the file name",
  layout: "the layout comes from proyectos.11tydata.json",
  text: 'use "text_es" (and optionally "text_en")',
  bio: 'use "text_es" (and optionally "text_en")',
  media_left: 'use one ordered "media" list',
  media_middle: 'use one ordered "media" list',
};

/**
 * Check a media source (or a video poster) against its type's folder, formats
 * and masters.
 *
 * @param {string} value the path written in the content
 * @param {"image"|"video"} type
 * @param {string} field the field, as the message names it (`"src"`, `"poster"`)
 * @param {{ assetsDir: string, inputDir: string }} context
 */
function checkSource(value, type, field, { assetsDir, inputDir }) {
  const spec = MEDIA[type];
  const source = String(value).trim();
  if (!source.startsWith(`${spec.folder}/`)) {
    return [`${field} must be a path under ${spec.folder}/`];
  }

  const errors = [];
  const extension = path.posix.extname(source).toLowerCase();
  if (!spec.formats.includes(extension.slice(1))) {
    // A wrong extension usually means a wrong file: report the format alone.
    return [`${field} has an unsupported ${type} format "${extension}"; use ${listFormats(spec.formats)}`];
  }

  // The image pipeline and the video element read the master's basename; a
  // missing master would otherwise surface as a crash deep in the build.
  const master = path.join(assetsDir, spec.folderName, path.posix.basename(source));
  if (!fs.existsSync(master)) {
    errors.push(`the master ${display(inputDir, master)} does not exist`);
  }

  return errors;
}

/** Check one gallery item; `index` is 1-based, as an editor counts them. */
function checkMediaItem(item, index, context) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return [`media[${index}] must be a media item with "type" and "src"`];
  }

  const source = typeof item.src === "string" ? item.src.trim() : "";
  const label = source ? `media[${index}] ("${source}")` : `media[${index}]`;
  const errors = [];
  const type = Object.hasOwn(MEDIA, item.type ?? "") ? item.type : null;

  if (!type) {
    // A legacy `video: true` item is reported once, with the fix, below.
    if (!Object.hasOwn(item, "video")) {
      errors.push(`${label}: "type" must be "image" or "video" (found: ${show(item.type)})`);
    }
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
      errors.push(`${label}: "poster" must be a path under ${MEDIA.image.folder}/`);
    }
    for (const flag of ["autoplay", "loop", "mute"]) {
      if (flag in item && typeof item[flag] !== "boolean") {
        errors.push(`${label}: "${flag}" must be true or false (found: ${show(item[flag])})`);
      }
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

/** Check one project's front matter; returns the problems, each naming a field. */
function checkProject(data, defaults, context) {
  const errors = [];
  const project = { ...defaults, ...data };

  // The project file carries only what an editor sets; the developer-only keys
  // (`layout`, `variant`, directory defaults) or the pre-CMS spellings are
  // leftovers the templates no longer interpret.
  for (const [key, hint] of Object.entries(LEGACY_KEYS)) {
    if (Object.hasOwn(data, key)) errors.push(`the legacy "${key}" key is not part of a project; ${hint}`);
  }

  if (!isNonEmptyString(project.title)) {
    errors.push('"title" is required and must be a non-empty string');
  }
  if (!isNonEmptyString(project.text_es)) {
    errors.push('"text_es" is required and must be a non-empty string');
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

  // Media masters are resolved next to the content, so the same check runs for
  // the site and for a throwaway content directory in the tests.
  const context = { inputDir, assetsDir: path.join(inputDir, "assets") };
  const defaults = directoryDefaults(projectDir);
  const errors = [];
  if (defaults.error) errors.push(`${display(inputDir, path.join(projectDir, DEFAULTS_FILE))}: ${defaults.error}`);

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
    for (const message of checkProject(front.data, defaults.data ?? {}, context)) {
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
export function assertProjectsValid(options) {
  const errors = checkProjects(options);
  if (!errors.length) return;

  throw new Error(
    [
      `Invalid project content (${errors.length} ${errors.length === 1 ? "problem" : "problems"}):`,
      ...errors.map((error) => `  - ${error}`),
      `Fix the front matter under ${display(options.inputDir, path.join(options.inputDir, PROJECT_DIR))}/ (.pages.yml describes each field).`,
    ].join("\n"),
  );
}
