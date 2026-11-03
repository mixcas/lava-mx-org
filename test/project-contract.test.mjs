import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, describe, it } from "node:test";

import yaml from "js-yaml";

import {
  checkProjects,
  LEGACY_KEYS,
  untranslatedFields,
  untranslatedReport,
} from "../lib/project-contract.js";
import { buildContentDir, projectFile, removeContentDirs, REPO_INPUT, writeContentDir } from "./support/contract.mjs";

after(removeContentDirs);

/** A gallery image, so a case can break one thing about a media item. */
const IMAGE = "/assets/images/lava-logo.png";
const VIDEO = "/assets/videos/LAVA-FLYER-MOTION.mp4";

/**
 * A project body that satisfies the contract; cases break one thing about it.
 * One entry carries both language versions as objects (ADR-0002), and only the
 * Spanish object is required.
 */
const VALID = {
  es: {
    title: "Proyecto de prueba",
    venue: "Galería",
    dates: "1 febrero - 1 abril, 2025.",
    text: "Texto en español.",
  },
  media: [{ type: "image", src: IMAGE }],
};

/** The same project, fully translated into English. */
const TRANSLATED = {
  ...VALID,
  en: {
    title: "Test project",
    venue: "Gallery",
    dates: "1 February - 1 April, 2025.",
    text: "English text.",
  },
};

/** A project content file from a front-matter object. */
const file = (frontMatter) => projectFile(yaml.dump(frontMatter));

/** `VALID` with top-level keys replaced (`undefined` removes the key). */
function project(overrides = {}) {
  const data = { ...VALID };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete data[key];
    else data[key] = value;
  }
  return file(data);
}

/**
 * One broken project and the one message the build must fail with. The message
 * names the content file and the field, so an editor knows what to fix.
 */
const INVALID = [
  {
    name: "a project with no language object at all",
    content: project({ es: undefined }),
    message: '"es" must be an object with "title" and "text" (found: nothing)',
  },
  {
    name: "a Spanish object with no title",
    content: project({ es: { venue: "Galería", text: "Texto en español." } }),
    message: '"es.title" is required and must be a non-empty string',
  },
  {
    name: "a blank Spanish title",
    content: project({ es: { title: "   ", text: "Texto en español." } }),
    message: '"es.title" is required and must be a non-empty string',
  },
  {
    name: "a Spanish object with no text",
    content: project({ es: { title: "Proyecto de prueba" } }),
    message: '"es.text" is required and must be a non-empty string',
  },
  {
    name: "a blank Spanish text",
    content: project({ es: { title: "Proyecto de prueba", text: " \n " } }),
    message: '"es.text" is required and must be a non-empty string',
  },
  {
    name: "a non-numeric order",
    content: project({ order: "primero" }),
    message: '"order" must be a number (found: "primero")',
  },
  {
    name: "a non-boolean homepage status",
    content: project({ featured: "sí" }),
    message: '"featured" must be true or false (found: "sí")',
  },
  {
    name: "three gallery columns",
    content: project({ gallery_columns: 3 }),
    message: '"gallery_columns" must be 1 or 2 (found: 3)',
  },
  {
    name: "zero gallery columns",
    content: project({ gallery_columns: 0 }),
    message: '"gallery_columns" must be 1 or 2 (found: 0)',
  },
  {
    name: "three gallery columns in the three-column variant",
    content: project({ variant: "three-column", gallery_columns: 3 }),
    message: '"gallery_columns" must be 1 or 2 (found: 3)',
  },
  {
    name: "an unknown layout variant",
    content: project({ variant: "four-column" }),
    message: '"variant" must be "standard" or "three-column" (found: "four-column")',
  },
];

/**
 * Legacy front-matter keys, and what replaced each one (the build's own list).
 * The old flat content keys are legacy now that every value lives in its
 * language object, and each message points at the key that replaced it.
 */
for (const [key, hint] of Object.entries(LEGACY_KEYS)) {
  INVALID.push({
    name: `the legacy "${key}" key`,
    content: project({ [key]: "legado" }),
    message: `the legacy "${key}" key is not part of a project; ${hint}`,
  });
}

/** A gallery item, so a case breaks one thing about a media item. */
const media = (...items) => project({ media: items });

INVALID.push(
  {
    name: "a gallery that is not a list",
    content: project({ media: "lava-logo.png" }),
    message: '"media" must be a list of media items',
  },
  {
    name: "a gallery item that is not a media item",
    content: media("lava-logo.png"),
    message: 'media[1] must be a media item with "type" and "src"',
  },
  {
    name: "a media item without a type",
    content: media({ src: IMAGE }),
    message: `media[1] ("${IMAGE}"): "type" must be "image" or "video" (found: nothing)`,
  },
  {
    name: "an unknown media type",
    content: media({ type: "audio", src: IMAGE }),
    message: `media[1] ("${IMAGE}"): "type" must be "image" or "video" (found: "audio")`,
  },
  {
    name: "a media item without a source",
    content: media({ type: "image" }),
    message: 'media[1]: "src" is required',
  },
  {
    name: "an image in an unsupported format",
    content: media({ type: "image", src: "/assets/images/foto.tiff" }),
    message:
      'media[1] ("/assets/images/foto.tiff"): "src" has an unsupported image format ".tiff"; use webp, jpg, jpeg, png, avif or gif',
  },
  {
    name: "an image source outside the image folder",
    content: media({ type: "image", src: "lava-logo.png" }),
    message: 'media[1] ("lava-logo.png"): "src" must be a path under /assets/images/',
  },
  {
    name: "an image whose master does not exist",
    content: media({ type: "image", src: "/assets/images/no-existe.webp" }),
    message: 'media[1] ("/assets/images/no-existe.webp"): the master src/assets/images/no-existe.webp does not exist',
  },
  {
    name: "a video in an unsupported format",
    content: media({ type: "video", src: "/assets/videos/reel.mov" }),
    message: 'media[1] ("/assets/videos/reel.mov"): "src" has an unsupported video format ".mov"; use mp4 or webm',
  },
  {
    name: "a video whose master does not exist",
    content: media({ type: "video", src: "/assets/videos/no-existe.mp4" }),
    message: 'media[1] ("/assets/videos/no-existe.mp4"): the master src/assets/videos/no-existe.mp4 does not exist',
  },
  {
    name: "alt text that is not text",
    content: media({ type: "image", src: IMAGE, alt: 42 }),
    message: `media[1] ("${IMAGE}"): "alt" must be a string (found: 42)`,
  },
  {
    name: "a video poster outside the image folder",
    content: media({ type: "video", src: VIDEO, poster: VIDEO }),
    message: `media[1] ("${VIDEO}"): "poster" must be a path under /assets/images/`,
  },
  {
    name: "a video poster whose master does not exist",
    content: media({ type: "video", src: VIDEO, poster: "/assets/images/no-existe.png" }),
    message: `media[1] ("${VIDEO}"): the master src/assets/images/no-existe.png does not exist`,
  },
  {
    name: "a legacy per-item video flag",
    content: media({ src: IMAGE, video: true }),
    message: `media[1] ("${IMAGE}"): the legacy "video" key is gone; use "type: video"`,
  },
  {
    name: "a legacy per-item muted flag",
    content: media({ type: "video", src: VIDEO, muted: true }),
    message: `media[1] ("${VIDEO}"): the legacy "muted" key is gone; use "mute"`,
  },
);

/**
 * The two language objects (ADR-0002): the Spanish object is the required
 * content, the English one is optional at every level, and each written value
 * is text because each written value is rendered.
 */
INVALID.push(
  {
    name: "a venue in the Spanish object that is not text",
    content: project({ es: { ...VALID.es, venue: 42 } }),
    message: '"es.venue" must be a string (found: 42)',
  },
  {
    name: "an English object that is not an object",
    content: project({ en: "English text." }),
    message: '"en" must be an object with "title", "venue", "dates" and "text" (found: "English text.")',
  },
  {
    name: "a title in the English object that is not text",
    content: project({ en: { title: 42 } }),
    message: '"en.title" must be a string (found: 42)',
  },
  {
    name: "an English object with a body that is not text",
    content: project({ en: { text: 42 } }),
    message: '"en.text" must be a string (found: 42)',
  },
  {
    name: "a broken gallery item behind the Spanish object",
    content: project({ media: [{ type: "image", src: "/assets/images/no-existe.webp" }] }),
    message: 'media[1] ("/assets/images/no-existe.webp"): the master src/assets/images/no-existe.webp does not exist',
  },
  {
    name: "alt text that is not text behind the Spanish object",
    content: project({ media: [{ type: "image", src: IMAGE, alt_en: 42 }] }),
    message: `media[1] ("${IMAGE}"): "alt_en" must be a string (found: 42)`,
  },
);

/**
 * A present English value that is blank claims a translation the page does not
 * have (ADR-0002): the CMS deletes an emptied field, so blank is never a value.
 */
for (const field of ["title", "venue", "dates", "text"]) {
  INVALID.push({
    name: `a blank ${field} in the English object`,
    content: project({ en: { [field]: "  \n " } }),
    message: `"en.${field}" is blank; remove the field or write the English value`,
  });
}
INVALID.push({
  name: "a blank English alt text",
  content: project({ media: [{ type: "image", src: IMAGE, alt_en: "   " }] }),
  message: `media[1] ("${IMAGE}"): "alt_en" is blank; remove the field or write the English value`,
});

describe("project content contract", () => {
  it("accepts the migrated repository", () => {
    assert.deepEqual(checkProjects({ inputDir: REPO_INPUT }), [], "the committed project content meets the contract");
  });

  it("accepts a valid project", () => {
    const inputDir = writeContentDir({ "valido.md": project() });

    assert.deepEqual(checkProjects({ inputDir }), []);
  });

  it("accepts a three-column project with two gallery columns", () => {
    const inputDir = writeContentDir({ "tres-columnas.md": project({ variant: "three-column", gallery_columns: 2 }) });

    assert.deepEqual(checkProjects({ inputDir }), []);
  });

  it("accepts a project written with only the Spanish object", () => {
    const inputDir = writeContentDir({ "solo-espanol.md": project() });

    assert.deepEqual(checkProjects({ inputDir }), []);
  });

  it("accepts a Spanish object without venue and dates (one project has no venue)", () => {
    const inputDir = writeContentDir({ "sin-sede.md": project({ es: { title: "Proyecto", text: "Texto." } }) });

    assert.deepEqual(checkProjects({ inputDir }), []);
  });

  it("accepts a project written with both language objects", () => {
    const inputDir = writeContentDir({
      "bilingue.md": file({
        ...TRANSLATED,
        media: [{ type: "image", src: IMAGE, alt_es: "Sala principal", alt_en: "Main room" }],
      }),
    });

    assert.deepEqual(checkProjects({ inputDir }), []);
  });

  it("accepts an empty English object as untranslated", () => {
    const inputDir = writeContentDir({ "vacio.md": project({ en: {} }) });

    assert.deepEqual(checkProjects({ inputDir }), []);
  });

  it("accepts an English object holding only the title it shares", () => {
    const inputDir = writeContentDir({ "neutro.md": project({ en: { title: "Proyecto de prueba" } }) });

    assert.deepEqual(checkProjects({ inputDir }), []);
  });

  it("accepts a neutral English value identical to the Spanish one", () => {
    const inputDir = writeContentDir({ "neutro.md": project({ en: { title: "Penumbra" } }) });

    assert.deepEqual(checkProjects({ inputDir }), []);
  });

  it("accepts typed image and video media items", () => {
    const inputDir = writeContentDir({
      "galeria.md": media(
        { type: "image", src: IMAGE, alt: "Logo" },
        { type: "video", src: VIDEO, poster: IMAGE, autoplay: true, loop: true, mute: true },
      ),
    });

    assert.deepEqual(checkProjects({ inputDir }), []);
  });

  for (const { name, content, message } of INVALID) {
    describe(name, () => {
      it("is reported against the project file and the field", () => {
        const inputDir = writeContentDir({ "penumbra.md": content });

        assert.deepEqual(checkProjects({ inputDir }), [`src/proyectos/penumbra.md: ${message}`]);
      });

      it("fails the build", async () => {
        const inputDir = writeContentDir({ "penumbra.md": content });

        await assert.rejects(buildContentDir(inputDir), (error) => {
          assert.ok(
            error.message.includes(`src/proyectos/penumbra.md: ${message}`),
            `build error must name the file and the field, got:\n${error.message}`,
          );
          return true;
        });
      });
    });
  }

  it("builds a project with no English object at all", async () => {
    const inputDir = writeContentDir({ "solo-espanol.md": project() });

    await assert.doesNotReject(buildContentDir(inputDir), "an untranslated project builds and deploys normally");
  });

  it("reports every problem of a project in one build failure", async () => {
    const inputDir = writeContentDir({
      "penumbra.md": project({ order: "primero", media: [{ type: "image", src: "/assets/images/no-existe.webp" }] }),
      "vestigios.md": project({ es: { text: "Texto en español." } }),
    });

    await assert.rejects(buildContentDir(inputDir), (error) => {
      const lines = error.message.split("\n");
      assert.match(lines[0], /^Invalid project content \(3 problems\):$/);
      assert.ok(
        lines.includes('  - src/proyectos/penumbra.md: "order" must be a number (found: "primero")'),
        `build error lists the order problem:\n${error.message}`,
      );
      assert.ok(
        lines.includes(
          '  - src/proyectos/penumbra.md: media[1] ("/assets/images/no-existe.webp"): the master src/assets/images/no-existe.webp does not exist',
        ),
        `build error lists the media problem:\n${error.message}`,
      );
      assert.ok(
        lines.includes('  - src/proyectos/vestigios.md: "es.title" is required and must be a non-empty string'),
        `build error lists the other project's problem:\n${error.message}`,
      );
      return true;
    });
  });

  it("rejects a project file that is not readable front matter", () => {
    const inputDir = writeContentDir({ "sin-front-matter.md": "Solo texto.\n" });

    assert.deepEqual(checkProjects({ inputDir }), [
      "src/proyectos/sin-front-matter.md: the file has no YAML front matter",
    ]);
  });

  it("fails the build when the directory defaults are missing", () => {
    const inputDir = writeContentDir({ "penumbra.md": project() });
    fs.rmSync(path.join(inputDir, "proyectos/proyectos.11tydata.json"));

    assert.deepEqual(checkProjects({ inputDir }), [
      "src/proyectos/proyectos.11tydata.json: the project directory defaults file is missing",
    ]);
  });
});

/**
 * The editorial translation tracker (ADR-0002, "Consequences"): the build
 * prints every Project and field whose English value is absent, without
 * failing. It is the only status view the Editors have — the CMS cannot show
 * translation status — so it must name the file and the fields to translate.
 */
describe("translation tracker", () => {
  it("lists each project with the fields whose English value is absent", () => {
    const inputDir = writeContentDir({
      "solo-espanol.md": project(),
      "bilingue.md": file(TRANSLATED),
    });

    assert.deepEqual(untranslatedFields({ inputDir }), [
      { file: "src/proyectos/solo-espanol.md", fields: ["en.title", "en.venue", "en.dates", "en.text"] },
    ]);
  });

  it("lists the fields still absent in a partly translated project", () => {
    const inputDir = writeContentDir({ "bilingue.md": project({ en: { title: "Test project" } }) });

    assert.deepEqual(untranslatedFields({ inputDir }), [
      { file: "src/proyectos/bilingue.md", fields: ["en.venue", "en.dates", "en.text"] },
    ]);
  });

  it("leaves out an optional Spanish value the project does not write", () => {
    const inputDir = writeContentDir({ "sin-sede.md": project({ es: { title: "Proyecto", text: "Texto." } }) });

    assert.deepEqual(untranslatedFields({ inputDir }), [
      { file: "src/proyectos/sin-sede.md", fields: ["en.title", "en.text"] },
    ]);
  });

  it("reports nothing for a fully translated corpus", () => {
    const inputDir = writeContentDir({ "bilingue.md": file(TRANSLATED) });

    assert.deepEqual(untranslatedFields({ inputDir }), []);
    assert.equal(untranslatedReport(untranslatedFields({ inputDir })), "");
  });

  it("formats the findings as one line per project", () => {
    const findings = [
      { file: "src/proyectos/penumbra.md", fields: ["en.title", "en.text"] },
      { file: "src/proyectos/piel-de-proxy.md", fields: ["en.text"] },
    ];

    assert.equal(
      untranslatedReport(findings),
      [
        "Untranslated English values (2 projects):",
        "  - src/proyectos/penumbra.md: en.title, en.text",
        "  - src/proyectos/piel-de-proxy.md: en.text",
      ].join("\n"),
    );
  });

  it("prints the list during the build without failing it", async () => {
    const inputDir = writeContentDir({
      "solo-espanol.md": project(),
      "bilingue.md": file(TRANSLATED),
    });

    const printed = [];
    const log = console.log;
    console.log = (...args) => printed.push(args.join(" "));
    try {
      await assert.doesNotReject(buildContentDir(inputDir), "an untranslated project never blocks a build");
    } finally {
      console.log = log;
    }

    const output = printed.join("\n");
    assert.ok(
      output.includes("  - src/proyectos/solo-espanol.md: en.title, en.venue, en.dates, en.text"),
      `the build prints the untranslated fields (it must survive quiet mode), got:\n${output}`,
    );
  });
});
