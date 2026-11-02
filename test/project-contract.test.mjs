import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, describe, it } from "node:test";

import yaml from "js-yaml";

import { checkProjects } from "../lib/project-contract.js";
import { buildContentDir, projectFile, removeContentDirs, REPO_INPUT, writeContentDir } from "./support/contract.mjs";

after(removeContentDirs);

/** A project body that satisfies the contract; cases break one thing about it. */
const VALID = {
  title: "Proyecto de prueba",
  text_es: "Texto en español.",
  media: [{ type: "image", src: "/assets/images/lava-logo.png" }],
};

/** A project content file from a front-matter object. */
const file = (frontMatter) => projectFile(yaml.dump(frontMatter));

/** `VALID` with keys replaced (`undefined` removes the key). */
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
    name: "a missing title",
    content: project({ title: undefined }),
    message: '"title" is required and must be a non-empty string',
  },
  {
    name: "a blank title",
    content: project({ title: "   " }),
    message: '"title" is required and must be a non-empty string',
  },
  {
    name: "a missing Spanish text",
    content: project({ text_es: undefined }),
    message: '"text_es" is required and must be a non-empty string',
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

/** Legacy front-matter keys, and what replaced each one. */
const LEGACY = {
  current: 'use "featured"',
  slug: "the URL comes from the file name",
  layout: "the layout comes from proyectos.11tydata.json",
  text: 'use "text_es" (and optionally "text_en")',
  bio: 'use "text_es" (and optionally "text_en")',
  media_left: 'use one ordered "media" list',
  media_middle: 'use one ordered "media" list',
};

for (const [key, hint] of Object.entries(LEGACY)) {
  INVALID.push({
    name: `the legacy "${key}" key`,
    content: project({ [key]: key === "text" || key === "bio" ? "Texto legado." : "legado" }),
    message: `the legacy "${key}" key is not part of a project; ${hint}`,
  });
}

/** A gallery item, so a case breaks one thing about a media item. */
const IMAGE = "/assets/images/lava-logo.png";
const VIDEO = "/assets/videos/LAVA-FLYER-MOTION.mp4";
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

  it("accepts typed image and video media items", () => {
    const inputDir = writeContentDir({
      "galeria.md": media(
        { type: "image", src: "/assets/images/lava-logo.png", alt: "Logo" },
        { type: "video", src: "/assets/videos/LAVA-FLYER-MOTION.mp4", poster: "/assets/images/lava-logo.png", autoplay: true, loop: true, mute: true },
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

  it("reports every problem of a project in one build failure", async () => {
    const inputDir = writeContentDir({
      "penumbra.md": project({ order: "primero", media: [{ type: "image", src: "/assets/images/no-existe.webp" }] }),
      "vestigios.md": project({ title: undefined }),
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
        lines.includes('  - src/proyectos/vestigios.md: "title" is required and must be a non-empty string'),
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
