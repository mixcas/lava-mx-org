import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildProjectView } from "../lib/project-view.js";

/**
 * The view model renders the content contract (`lib/project-contract.js`), so
 * it reads the canonical shapes only. The migration's temporary tolerance for
 * pre-contract content is gone: a legacy shape is rejected by the build, never
 * silently reinterpreted here.
 */
describe("project view model", () => {
  it("normalizes canonical asset paths to the media basenames the pipeline reads", () => {
    const view = buildProjectView({
      title: "Proyecto",
      media: [
        { type: "image", src: "/assets/images/uno.webp" },
        { type: "video", src: "/assets/videos/dos.mp4", poster: "/assets/images/poster.webp", autoplay: true, loop: true, mute: true },
      ],
    });

    assert.deepEqual(view.gallery, [
      { type: "image", src: "uno.webp", alt: "Proyecto" },
      { type: "video", src: "dos.mp4", poster: "poster.webp", autoplay: true, loop: true, mute: true },
    ]);
  });

  it("keeps an item's own alt text", () => {
    const view = buildProjectView({
      title: "Proyecto",
      media: [{ type: "image", src: "/assets/images/uno.webp", alt: "Sala principal" }],
    });

    assert.equal(view.gallery[0].alt, "Sala principal");
  });

  it("falls back to the project title when the alt text is only whitespace", () => {
    const view = buildProjectView({
      title: "Proyecto",
      media: [
        { type: "image", src: "/assets/images/uno.webp", alt: "   " },
        { type: "image", src: "/assets/images/dos.webp", alt: "" },
      ],
    });

    assert.deepEqual(
      view.gallery.map((item) => item.alt),
      ["Proyecto", "Proyecto"],
    );
  });

  it("no longer merges the separate media_left and media_middle galleries", () => {
    const view = buildProjectView({
      title: "Proyecto",
      variant: "three-column",
      media_left: [{ src: "/assets/images/izquierda.webp" }],
      media_middle: [{ src: "/assets/images/centro.webp" }],
      media: [{ type: "image", src: "/assets/images/uno.webp" }],
    });

    assert.deepEqual(view.gallery, [{ type: "image", src: "uno.webp", alt: "Proyecto" }]);
  });

  it("no longer reads the legacy per-item video and muted flags", () => {
    const view = buildProjectView({
      title: "Proyecto",
      media: [{ src: "/assets/images/uno.webp", video: true, muted: true }],
    });

    assert.deepEqual(view.gallery, [{ type: "image", src: "uno.webp", alt: "Proyecto" }]);
  });
});

/**
 * The content model carries a project's two language versions as an `es` object
 * and an optional `en` object (ADR-0002). Today's flat keys describe the same
 * project with one language-neutral set of values, so both shapes must resolve
 * to the same view model: templates render one shape, whichever the content
 * uses.
 */
describe("project view model with the two language objects", () => {
  /** The same project written with today's flat keys. */
  const FLAT = {
    url: "/proyectos/corteza-liquida/",
    title: "Corteza Líquida",
    venue: "laNao Galería",
    dates: "1 febrero - 1 abril, 2025.",
    text_es: "Una exposición individual.",
    gallery_columns: 2,
    media: [
      { type: "image", src: "/assets/images/uno.webp", alt: "Sala principal" },
      { type: "image", src: "/assets/images/dos.webp" },
      { type: "video", src: "/assets/videos/reel.mp4", poster: "/assets/images/poster.webp", autoplay: true, loop: true, mute: true },
    ],
  };

  /** The same project written with the `es` object. */
  const OBJECTS = {
    url: "/proyectos/corteza-liquida/",
    es: {
      title: "Corteza Líquida",
      venue: "laNao Galería",
      dates: "1 febrero - 1 abril, 2025.",
      text: "Una exposición individual.",
    },
    gallery_columns: 2,
    media: [
      { type: "image", src: "/assets/images/uno.webp", alt_es: "Sala principal" },
      { type: "image", src: "/assets/images/dos.webp" },
      { type: "video", src: "/assets/videos/reel.mp4", poster: "/assets/images/poster.webp", autoplay: true, loop: true, mute: true },
    ],
  };

  it("resolves today's flat keys and the two language objects to the same values", () => {
    assert.deepEqual(buildProjectView(OBJECTS), buildProjectView(FLAT));
  });

  it("resolves the same values when both shapes write the English version", () => {
    const flat = { title: "Corteza Líquida", text_es: "Una exposición individual.", text_en: "A solo exhibition." };
    const objects = {
      es: { title: "Corteza Líquida", text: "Una exposición individual." },
      en: { title: "Corteza Líquida", text: "A solo exhibition." },
    };

    assert.deepEqual(buildProjectView(objects), buildProjectView(flat));
  });

  it("resolves a project with no English object with no English body", () => {
    assert.deepEqual(buildProjectView(OBJECTS).text, {
      spanish: "Una exposición individual.",
      english: null,
    });
  });

  it("resolves the English body when the content writes one", () => {
    const view = buildProjectView({
      es: { title: "Corteza Líquida", text: "Una exposición individual." },
      en: { title: "Liquid Crust", text: "A solo exhibition." },
    });

    assert.deepEqual(view.text, { spanish: "Una exposición individual.", english: "A solo exhibition." });
  });

  it("treats an English object with a blank body as untranslated", () => {
    const view = buildProjectView({
      es: { title: "Corteza Líquida", text: "Una exposición individual." },
      en: { title: "Liquid Crust", text: "   " },
    });

    assert.equal(view.text.english, null);
  });

  it("keeps resolving the flat English body", () => {
    const view = buildProjectView({ title: "Proyecto", text_es: "Texto en español.", text_en: "English text." });

    assert.deepEqual(view.text, { spanish: "Texto en español.", english: "English text." });
  });

  /**
   * An image's alt text resolves the English alt, then the English title, then
   * the Spanish title (ADR-0002). The Spanish version reads its own alt first.
   */
  describe("image alt text", () => {
    const IMAGE = { type: "image", src: "/assets/images/uno.webp" };
    const alt = (data, language) => buildProjectView(data, language).gallery[0].alt;

    it("resolves the English alt text on the English version", () => {
      const data = {
        es: { title: "Corteza Líquida", text: "Texto." },
        en: { title: "Liquid Crust", text: "Text." },
        media: [{ ...IMAGE, alt_es: "Sala principal", alt_en: "Main room" }],
      };

      assert.equal(alt(data, "en"), "Main room");
    });

    it("resolves the English title when the English alt is unwritten", () => {
      const data = {
        es: { title: "Corteza Líquida", text: "Texto." },
        en: { title: "Liquid Crust", text: "Text." },
        media: [{ ...IMAGE, alt_es: "Sala principal" }],
      };

      assert.equal(alt(data, "en"), "Liquid Crust");
    });

    it("resolves the Spanish title when the project has no English object", () => {
      const data = {
        es: { title: "Corteza Líquida", text: "Texto." },
        media: [{ ...IMAGE, alt_es: "Sala principal" }],
      };

      assert.equal(alt(data, "en"), "Corteza Líquida");
    });

    it("resolves the Spanish alt text on the Spanish version", () => {
      const data = {
        es: { title: "Corteza Líquida", text: "Texto." },
        en: { title: "Liquid Crust", text: "Text." },
        media: [{ ...IMAGE, alt_es: "Sala principal", alt_en: "Main room" }],
      };

      assert.equal(alt(data, "es"), "Sala principal");
      assert.equal(alt(data), "Sala principal", "Spanish is the default version");
    });

    it("serves the language-neutral flat alt text to both versions", () => {
      const data = { title: "Proyecto", text_es: "Texto.", media: [{ ...IMAGE, alt: "Sala principal" }] };

      assert.equal(alt(data, "es"), "Sala principal");
      assert.equal(alt(data, "en"), "Sala principal");
    });
  });
});
