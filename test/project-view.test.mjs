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
