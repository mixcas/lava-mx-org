# Lava-mx.org — Cargo → 11ty Migration Plan

## Locked decisions

| Decision | Choice |
|---|---|
| Generator | Eleventy (11ty) v3 + Nunjucks |
| Hosting | GitHub Pages, built via GitHub Actions |
| Domain | Project subpath first (`user.github.io/<repo>/`), custom domain later; `pathPrefix`-driven from day one |
| Typography | Self-hosted open lookalikes: **Instrument Sans** (body/headings) + **JetBrains Mono** (captions) |
| Fidelity | Faithful rebuild of grid, type scale, sticky nav/footer, image arrangements |
| Content model | One Markdown file per project; front matter for metadata, Markdown body with `{% img %}` shortcode |
| URLs | **Clean slugs, no legacy-URL preservation** (accepted tradeoff: old Cargo links will 404) |
| Maintainers | 11ty runs in CI; optimized image masters committed, originals backed up out-of-repo |

## Target page inventory

- `/` — home, current exhibitions (Mineralia indisciplinada, Y las entrañas gritaron, Corteza Líquida)
- `/acerca-de/` — About / collective bio
- `/proyectos/` — index of past projects
- `/proyectos/<slug>/` — 12 project pages: `mineralia-indisciplinada`, `y-las-entranas-gritaron`, `corteza-liquida`, `tramas-de-lo-indomito`, `tiempos-pendulares`, `infernal-natures`, `penumbra`, `vestigios-metabolicos`, `piel-de-proxy`, `open-studio-christian-wedel`, `sangre-y-savia`, `lianas-neotropicales`
- `404.html` — not-found page
- *Excluded:* Cargo internals (`top-nav---desktop`, `top-nav---mobile`, `header-1`, `footer`) and stale About drafts (`acerca-de-1`)

---

## Phase 0 — Scaffolding & content backup

**Goal:** Safe starting point; nothing can be lost if Cargo changes before cutover.

**Tasks**
- Create repo layout and `package.json`; install 11ty v3, `@11ty/eleventy-img`, Nunjucks, sitemap/robots plugins.
- Add `.gitignore`, `.nojekyll` handling, and `eleventy.config.js` with `dir.input=src`, `dir.output=_site`.
- Configure `pathPrefix` from env var (`PATH_PREFIX`, default `/`) and expose a base URL data value.
- Write `scripts/backup.mjs`: fetch every content page and save raw HTML **and** its `window.__PRELOADED_STATE__` JSON into `_cargo-export/`.
- Git-ignore `_cargo-export/`.

**Deliverable:** Repo skeleton + complete raw backup of all content pages and asset metadata.

**Done when:** `_cargo-export/` contains all pages/state; `npx @11ty/eleventy` runs an empty-site build.

---

## Phase 1 — Content extraction

**Goal:** Convert Cargo pages into editable Markdown + data, with no manual copy/paste.

**Tasks**
- `scripts/extract.mjs` parses each backed-up page:
  - Read layout markup (`column-set` / `column-unit` spans, `media-item` hashes) and all text.
  - Resolve each hash via `pages.byId[].media` metadata (name, width, height, mime type).
- Emit `src/proyectos/<slug>.md` with front matter: bilingual title, `venue`, `location`, `dates`, `artists`, `links`, `current` (bool), `order`, `layout`, and ordered `media` list.
- Emit body Markdown using `{% img "filename" %}` shortcodes to preserve per-project arrangements:
  - standard two-column (span-8 images / span-4 text)
  - 2-column galleries (`lianas-neotropicales`)
  - special 3-column layout (`infernal-natures`)
- Write `src/acerca-de.md` from the About page.
- Add `src/_data/site.json` (nav labels, emails, Instagram handle, default meta).

**Deliverable:** 12 project Markdown files + About page + site config.

**Done when:** Every project renders with correct text, ordering, and media references (assets pending from Phase 2).

---

## Phase 2 — Asset pipeline

**Goal:** Self-host all media, small enough for a healthy GitHub repo.

**Tasks**
- `scripts/fetch-assets.mjs` downloads originals from `https://freight.cargo.site/t/original/i/{hash}/{name}`: ~120 images, reels (`.mov`/`.mp4`), PDF dossiers, logo (`LAVA_Logo-01.png`), favicon.
- Images → resize/re-encode to WebP (+ AVIF) masters at a max width (~2400px), committed to `src/assets/images/`.
- Videos → compressed web-friendly versions; PDFs copied as-is.
- Wire `@11ty/eleventy-img` to emit responsive `<picture>` with intrinsic `width`/`height`.
- Keep raw originals only in the local backup (not committed) to protect repo size.

**Deliverable:** `src/assets/images/` masters + video/PDF assets + image shortcode/template transform.

**Done when:** All pages render images locally via eleventy-img, and the committed repo stays small.

---

## Phase 3 — Core site build

**Goal:** Faithful shell — layout, chrome, typography.

**Tasks**
- Layouts: `base.njk` (head/meta, nav, header, footer), `project.njk`, `page.njk`.
- Partials matching current chrome:
  - pinned top nav: `Lava es — Lava is` · `info.lavamx` · `Proyectos anteriores` (menu icon) · `hola@lava-mx.org`
  - centered logo header linking home
  - pinned footer: `©LAVA · Ciudad de México · @lava__mx`
- `assets/css/main.css`: port Cargo design tokens — white bg, black alpha ramp, type scale (1.5rem body, 9rem h1, 3.4rem h2, 1.2rem captions), 12-column grid, sticky nav/footer, responsive/mobile stacking. Authored from scratch (not copying licensed Cargo CSS).
- Self-host Instrument Sans + JetBrains Mono `.woff2` with `@font-face`; set fallbacks to minimize layout shift.

**Deliverable:** Reusable layouts + full design-system stylesheet + self-hosted fonts.

**Done when:** A sample project page visually matches the original chrome and typography.

---

## Phase 4 — Pages & content wiring

**Goal:** All content pages generated from the Markdown/data.

**Tasks**
- `index.njk` — home renders projects where `current: true`.
- `proyectos.njk` — index of all non-current projects, in `order`.
- Project pages from `src/proyectos/*.md` (permalink `/proyectos/<slug>/`).
- `acerca-de.md` page.
- `404.njk`.

**Deliverable:** Complete static site.

**Done when:** All 12 projects, home, index, About, and 404 build and navigate correctly.

---

## Phase 5 — SEO, performance & accessibility

**Goal:** Correct metadata and good Core Web Vitals.

**Tasks**
- Reuse existing titles/descriptions; add OG/Twitter tags and favicon.
- `sitemap.xml` (excluding internals/404) and `robots.txt`, using configurable `baseUrl` + `pathPrefix`.
- Responsive images with width/height; lazy-loading below the fold; `preload` hero/LCP image.
- Heading hierarchy, link/alt text, focus styles, color-contrast checks on the black-alpha palette.
- Minimal JS only (e.g., lightbox if desired); prefer CSS.

**Deliverable:** SEO files + perf/a11y pass.

**Done when:** Lighthouse ≥ 90 on Performance/Accessibility/SEO for representative pages.

---

## Phase 6 — CI/CD, deployment & cutover

**Goal:** Automated deploy to GitHub Pages, then retire Cargo.

**Tasks**
- `.github/workflows/deploy.yml`: install → `npm run build` (with `PATH_PREFIX=/<repo>/`) → `upload-pages-artifact` → `deploy-pages`.
- Add `.nojekyll` to output; enable Pages (Actions source).
- Verify on `user.github.io/<repo>/`.
- Custom-domain switch checklist: set `site.baseUrl`/`PATH_PREFIX=/`, add `CNAME` = `lava-mx.org`, configure GitHub Pages domain + HTTPS, repoint DNS (A/AAAA + `www` CNAME).
- Final visual QA on desktop + mobile against the current site.
- Cancel Cargo only after new site is live and verified.

**Deliverable:** Live GitHub Pages site + runbook for the domain switch.

**Done when:** Site is publicly reachable at the target URL and Cargo can be cancelled.

---

## Risks & notes for review

1. **Broken old links** — accepted per decision; search/Instagram links to old Cargo URLs will 404. Can be revisited with redirect stubs if that changes.
2. **Repo size** — ~1 GB of originals must never be committed; only optimized masters. Confirm this is acceptable vs. Git LFS + CI optimization.
3. **Asset download time** — ~1 GB from `freight.cargo.site`; run Phase 2 well before cancelling Cargo.
4. **Font substitution** — Instrument Sans/JetBrains Mono are close but not identical to Diatype; adjust weights/letter-spacing in review.
5. **Cargo-dependent content** — reels and PDF dossiers live on `freight.cargo.site`; all must be mirrored in Phase 2 or their links break.

---

## Review questions

- Is the phase order and granularity right, and do you want the image masters committed (recommended) or handled via Git LFS?
- Any changes to the page inventory or chrome before starting?
