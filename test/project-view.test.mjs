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

  it("does not read a language-neutral alt text, which the content model retired", () => {
    // The media shape is `alt_es` / (optional) `alt_en` only; the contract
    // rejects a flat `alt`, so the view model never resolves one either.
    const view = buildProjectView({
      es: SPANISH,
      media: [{ type: "image", src: "/assets/images/uno.webp", alt: "Sala principal" }],
    });

    assert.equal(view.gallery[0].alt, "Corteza Líquida", "the project title stands in for the unwritten alt");
  });

  it("falls back to the project title when the alt text is only whitespace", () => {
    const view = buildProjectView({
      es: SPANISH,
      media: [
        { type: "image", src: "/assets/images/uno.webp", alt_es: "   " },
        { type: "image", src: "/assets/images/dos.webp", alt_es: "" },
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
    assert.deepEqual(view.text, { body: "", language: "es", fallback: false });
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
    assert.deepEqual(view.text, { body: "Una exposición individual.", language: "es", fallback: false });
  });

  it("renders the Spanish body on the English version of a project with no English object", () => {
    // The English page of an untranslated project shows the Spanish text, and
    // says so in the model: the block renders as Spanish, with no notice
    // (ADR-0002: an untranslated field falls back silently).
    const view = buildProjectView(OBJECTS, "en");

    assert.deepEqual(view.text, { body: "Una exposición individual.", language: "es", fallback: true });
    assert.deepEqual(view.fallback, { title: true, venue: true, dates: true, text: true });
  });

  it("resolves the English body when the content writes one", () => {
    const view = buildProjectView(
      {
        es: SPANISH,
        en: { title: "Liquid Crust", text: "A solo exhibition." },
      },
      "en",
    );

    assert.deepEqual(view.text, { body: "A solo exhibition.", language: "en", fallback: false });
    assert.equal(view.fallback.text, false);
  });

  it("never hands the other language's text to a page", () => {
    const data = {
      es: { title: "Corteza Líquida", venue: "laNao Galería", dates: "1 febrero, 2025.", text: "Texto en español." },
      en: { title: "Liquid Crust", venue: "laNao Gallery", dates: "1 February, 2025.", text: "English text." },
    };

    const spanish = buildProjectView(data, "es");
    assert.equal(spanish.language, "es");
    assert.ok(!JSON.stringify(spanish).includes("English text."), "the Spanish version carries no English text");
    assert.ok(!JSON.stringify(spanish).includes("Liquid Crust"), "the Spanish version carries no English title");

    const english = buildProjectView(data, "en");
    assert.equal(english.language, "en");
    assert.ok(!JSON.stringify(english).includes("Texto en español."), "the English version carries no Spanish text");
  });

  it("addresses each language version of a project at its own URL", () => {
    assert.equal(buildProjectView(OBJECTS).url, "/proyectos/corteza-liquida/");
    assert.equal(buildProjectView(OBJECTS, "en").url, "/en/proyectos/corteza-liquida/");
    assert.equal(
      buildProjectView({ ...OBJECTS, url: "/en/proyectos/corteza-liquida/" }, "en").url,
      "/en/proyectos/corteza-liquida/",
      "a page that is already the English version keeps its own URL",
    );
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

    assert.deepEqual(view.fallback, { title: false, venue: true, dates: true, text: true });
    assert.deepEqual(view.text, { body: "Texto.", language: "es", fallback: true }, "an unwritten English body is the Spanish one");
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

    it("serves neither version a language-neutral alt text", () => {
      const data = { es: { title: "Corteza Líquida", text: "Texto." }, media: [{ ...IMAGE, alt: "Sala principal" }] };

      assert.equal(alt(data, "es"), "Corteza Líquida");
      assert.equal(alt(data, "en"), "Corteza Líquida");
    });
  });
});
