import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildProjectView } from "../lib/project-view.js";

/** A project body that satisfies the contract: one entry, two language objects. */
const SPANISH = { title: "Corteza Líquida", text: "Una exposición individual." };

/**
 * The view model renders the content contract (`lib/project-contract.js`), so
 * it reads the canonical shape only: an `es` object and an optional `en` object
 * (ADR-0002). A legacy flat value is rejected by the build, never silently
 * reinterpreted here.
 */
describe("project view model", () => {
  it("normalizes canonical asset paths to the media basenames the pipeline reads", () => {
    const view = buildProjectView({
      es: SPANISH,
      media: [
        { type: "image", src: "/assets/images/uno.webp" },
        { type: "video", src: "/assets/videos/dos.mp4", poster: "/assets/images/poster.webp", autoplay: true, loop: true, mute: true },
      ],
    });

    assert.deepEqual(view.gallery, [
      { type: "image", src: "uno.webp", alt: "Corteza Líquida" },
      { type: "video", src: "dos.mp4", poster: "poster.webp", autoplay: true, loop: true, mute: true },
    ]);
  });

  it("keeps an item's own language-neutral alt text", () => {
    const view = buildProjectView({
      es: SPANISH,
      media: [{ type: "image", src: "/assets/images/uno.webp", alt: "Sala principal" }],
    });

    assert.equal(view.gallery[0].alt, "Sala principal");
  });

  it("falls back to the project title when the alt text is only whitespace", () => {
    const view = buildProjectView({
      es: SPANISH,
      media: [
        { type: "image", src: "/assets/images/uno.webp", alt: "   " },
        { type: "image", src: "/assets/images/dos.webp", alt: "" },
      ],
    });

    assert.deepEqual(
      view.gallery.map((item) => item.alt),
      ["Corteza Líquida", "Corteza Líquida"],
    );
  });

  it("does not merge the separate media_left and media_middle galleries", () => {
    const view = buildProjectView({
      es: SPANISH,
      variant: "three-column",
      media_left: [{ src: "/assets/images/izquierda.webp" }],
      media_middle: [{ src: "/assets/images/centro.webp" }],
      media: [{ type: "image", src: "/assets/images/uno.webp" }],
    });

    assert.deepEqual(view.gallery, [{ type: "image", src: "uno.webp", alt: "Corteza Líquida" }]);
  });

  it("does not read the legacy per-item video and muted flags", () => {
    const view = buildProjectView({
      es: SPANISH,
      media: [{ src: "/assets/images/uno.webp", video: true, muted: true }],
    });

    assert.deepEqual(view.gallery, [{ type: "image", src: "uno.webp", alt: "Corteza Líquida" }]);
  });

  it("does not read the legacy flat fields", () => {
    const view = buildProjectView({
      title: "Corteza Líquida",
      venue: "laNao Galería",
      dates: "1 febrero - 1 abril, 2025.",
      text_es: "Una exposición individual.",
      text_en: "A solo exhibition.",
    });

    assert.equal(view.title, "");
    assert.equal(view.venue, null);
    assert.equal(view.dates, null);
    assert.deepEqual(view.text, { spanish: "", english: null });
  });
});

/**
 * A project's two language versions are an `es` object and an optional `en`
 * object (ADR-0002). The Spanish version is the default; the English one reads
 * its own values and falls back to Spanish, field by field, where a value is
 * unwritten.
 */
describe("project view model with the two language objects", () => {
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

  it("renders the Spanish values of a project with no English object", () => {
    const view = buildProjectView(OBJECTS);

    assert.equal(view.url, "/proyectos/corteza-liquida/");
    assert.equal(view.title, "Corteza Líquida");
    assert.equal(view.venue, "laNao Galería");
    assert.equal(view.dates, "1 febrero - 1 abril, 2025.");
    assert.equal(view.columns, 2, "the gallery columns are shared by both versions");
    assert.deepEqual(view.text, { spanish: "Una exposición individual.", english: null });
  });

  it("renders a project with no English object with no English body", () => {
    assert.deepEqual(buildProjectView(OBJECTS).text, {
      spanish: "Una exposición individual.",
      english: null,
    });
  });

  it("resolves the English body when the content writes one", () => {
    const view = buildProjectView({
      es: SPANISH,
      en: { title: "Liquid Crust", text: "A solo exhibition." },
    });

    assert.deepEqual(view.text, { spanish: "Una exposición individual.", english: "A solo exhibition." });
  });

  it("renders the English values on the English version", () => {
    const view = buildProjectView(
      {
        es: { title: "Corteza Líquida", venue: "laNao Galería", dates: "1 febrero, 2025.", text: "Texto." },
        en: { title: "Liquid Crust", venue: "laNao Gallery", dates: "1 February, 2025.", text: "Text." },
      },
      "en",
    );

    assert.equal(view.title, "Liquid Crust");
    assert.equal(view.venue, "laNao Gallery");
    assert.equal(view.dates, "1 February, 2025.");
  });

  it("falls back to Spanish field by field on the English version", () => {
    const data = {
      es: { title: "Corteza Líquida", venue: "laNao Galería", dates: "1 febrero, 2025.", text: "Texto." },
      en: { title: "Liquid Crust" },
    };

    const view = buildProjectView(data, "en");

    assert.equal(view.title, "Liquid Crust", "the written English value wins");
    assert.equal(view.venue, "laNao Galería", "an unwritten English value shows the Spanish one");
    assert.equal(view.dates, "1 febrero, 2025.");
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

    it("serves the language-neutral alt text to both versions", () => {
      const data = { es: { title: "Corteza Líquida", text: "Texto." }, media: [{ ...IMAGE, alt: "Sala principal" }] };

      assert.equal(alt(data, "es"), "Sala principal");
      assert.equal(alt(data, "en"), "Sala principal");
    });
  });
});
