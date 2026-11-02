# lava-mx.org

Static site for [Lava](https://lava-mx.org), a curatorial collective in Mexico
City. Migrated from Cargo to an [Eleventy](https://www.11ty.dev/) site and
deployed to GitHub Pages.

## Documentation

- [`docs/editor-guide.md`](docs/editor-guide.md) — curator guide (Spanish):
  signing in with the invitation, finding and editing a project, the gallery,
  the bilingual text, the About page and the site settings, publishing, waiting
  for the deploy, and the filename/URL warning.
- [`docs/maintainer-checklist.md`](docs/maintainer-checklist.md) — installing
  the Pages CMS GitHub App, inviting editors by email, verifying the CMS on a
  non-production branch, and merging to production. App installation and
  invitations are **manual maintainer actions**.
- [`GLOSSARY.md`](GLOSSARY.md) — the domain vocabulary: project, homepage
  project, archive project, gallery, media item, media source, and the editor and
  maintainer roles.
- [`docs/adr/0001-pages-cms.md`](docs/adr/0001-pages-cms.md) — the Pages CMS
  decision and its trade-offs.
- [`MIGRATION-PLAN.md`](MIGRATION-PLAN.md) — historical: the original Cargo →
  Eleventy plan, kept for reference (its content model predates the current
  schema; see the note at its top).

## Stack

- **Eleventy v3** (Nunjucks templates, Markdown content)
- **@11ty/eleventy-img** for responsive AVIF/WebP images
- Self-hosted **Instrument Sans** + **JetBrains Mono** (OFL)
- Deployed via **GitHub Actions** to **GitHub Pages**

## Requirements

- Node **20.19+** and npm (the build reads `import.meta.dirname`, which needs
  20.11+, and the suite uses the built-in test runner; the installed tooling
  declares 20.19+ as well)

## Commands

| Command | Description |
|---|---|
| `npm run serve` | Build and serve locally with live reload |
| `npm run build` | Build the site into `_site/` |
| `npm test` | Build once and assert the generated site plus the content contract (`test/*.test.mjs`) |
| `npm run clean` | Remove the build output |
| `npm run backup` | Mirror the live Cargo site into `_cargo-export/` |
| `npm run extract` | Parse the backup into `src/proyectos/*.md`, `src/acerca-de.md`, site data |
| `npm run fetch-assets` | Download + optimize media, localize PDF dossiers |

```bash
npm install
npm run serve   # http://localhost:8080
```

## Tests

```bash
npm test
```

`npm test` runs the Node built-in test runner against the generated site: it
builds the site once into `_site/` (clearing stale HTML but keeping `_site/img`,
so the responsive-image cache makes re-runs take about a second), then parses
the generated HTML with `node-html-parser` and asserts the public behaviour —

- all twelve project URLs at `/proyectos/<filename>/`, and no other entry under
  `/proyectos/`;
- homepage and `/proyectos/` membership and order, and a sitemap listing every
  page;
- each project page's title, venue, dates, text (Spanish and, when it exists,
  English), and every gallery image and video;
- the About page biography and team;
- `description`, canonical URL, and social image metadata on every page;
- the content contract: the project directory defaults, that no project file
  carries a legacy `current` / `slug` / `layout` key, and that `.pages.yml`
  still declares the project collection the editors depend on.

`test/project-contract.test.mjs` covers build-time validation: the migrated
content passes, and each broken rule (a missing title, a non-numeric `order`, a
legacy key, a bad media item, a missing master…) fails a real build with a
message naming the file and the field. `test/project-view.test.mjs` pins the
view model's canonical reading of media items.

Expectations live in `test/support/projects.mjs` as editorial facts about the
live site, not as a copy of the templates. Failures name the page and the
assertion, for example
`page /proyectos/penumbra/: gallery images rendered`.

The build honours the same variables as `npm run build`, so the suite can be
run for a subpath deployment or any origin:

```bash
PATH_PREFIX=/lava-mx-org/ SITE_URL=https://example.github.io npm test
```

In CI, run it after `npm ci` with the same `PATH_PREFIX` / `SITE_URL` values
used for the deploy build (see `.github/workflows/deploy.yml`), and cache
`_site/img` between runs as the deploy workflow already does.

## Project structure

```
src/
  _data/site.json              Site config (nav, emails, footer)
  _includes/layouts/           base / project / about / page layouts
  proyectos/<filename>.md      One file per exhibition (front matter + text)
  proyectos/proyectos.11tydata.json  Directory defaults shared by every project
  index.njk                    Home — Homepage projects
  proyectos.njk                /proyectos/ — Archive projects index
  acerca-de.md                 About
  404.njk · sitemap.njk · robots.njk
  assets/                      css, fonts, images (masters), videos, files (PDFs)
scripts/
  backup.mjs                   Phase 0 — mirror Cargo
  extract.mjs                  Phase 1 — Cargo → Markdown/JSON
  fetch-assets.mjs             Phase 2 — download + optimize assets
test/
  site.test.mjs                Generated-site assertions (`npm test`)
  support/                     Build-once harness + baseline expectations
.github/workflows/deploy.yml   Build + deploy to GitHub Pages
_cargo-export/                 Raw Cargo backup (git-ignored)
```

## Content model

### Project directory defaults

`src/proyectos/proyectos.11tydata.json` is an Eleventy directory data file: it
applies to every Markdown file in `src/proyectos/`, including projects an editor
creates later. It supplies

```json
{ "layout": "project", "variant": "standard", "featured": false, "order": 0, "gallery_columns": 1 }
```

so a project file only carries values that differ from those defaults.

### Front matter

Each project is a Markdown file in `src/proyectos/` with front matter:

```yaml
title: "Mineralia indisciplinada"
venue: "Museo Universitario del Chopo."
dates: "**Inauguración:** Octubre 23, 2025 — Marzo 2026"
featured: true          # homepage project; omitted (false) means archive project
order: 1                # position within its group (homepage or archive)
media:                  # ordered media items; the list order is the display order
  - type: image
    src: "/assets/images/DSC01858.webp"
    # alt: optional; omitted means the project title is used
  - type: video
    src: "/assets/videos/Reel_chopo_audio.mp4"
    poster: "/assets/images/Mineralia-0143-B2766344.webp"   # optional
    # autoplay / loop / mute: only written when enabled
text_es: |-             # Spanish text, required; rendered first, with Markdown
  ...
text_en: |-             # English text, optional; rendered after the divider
  ...
```

Only non-default values appear: `variant: three-column` (Infernal Natures) and
`gallery_columns: 2` (Lianas Neotropicales). The file name is the public URL:
`src/proyectos/penumbra.md` → `/proyectos/penumbra/`. There is no `slug` key.

A project's text is two explicit fields: `text_es` (Spanish, required) and
`text_en` (English, optional). The template renders the Spanish text, then a
`//` divider, then the English text — the divider is markup
(`project-body__divider`), never content, so no project file contains it. A
project without `text_en` renders Spanish only. Language-neutral links and
downloads belong at the end of `text_es`, so they do not disappear when the
English text is empty. The page `<meta name="description">` falls back to the
start of `text_es`.

`variant: three-column` is the archived Infernal Natures layout and the only
place it is written: it is not part of the Pages CMS schema, so the editor never
shows it and merge mode keeps it on save. That project's gallery is one ordered
list like every other project's; the template splits it in half for the
three-column layout — the first column takes the first half rounded up, the
second column takes the rest (`lib/project-view.js` computes `splitAt`).

Each media item is typed: an image has a `src` and optional `alt`, a video has a
`src`, optional `poster`, and `autoplay` / `loop` / `mute` flags. Sources are
canonical asset paths — `/assets/images/…` for images (masters in
`src/assets/images/`), `/assets/videos/…` for videos, `/assets/files/…` for
documents. `lib/project-view.js` normalizes those paths to the master basename
the image pipeline reads. Images are processed by `@11ty/eleventy-img` into the
responsive variants at build time. Dossier PDFs live in `src/assets/files/` and
are linked root-relative (`/assets/files/...`); the build applies the deployment
path prefix (`lib/path-prefix.js`), so they work under any base path.

Content is edited by hand or through Pages CMS, and always in this one canonical
shape: one typed gallery, `text_es` / `text_en`, `bio_es` / `bio_en` / `team` on
the About page, and canonical asset paths. The build rejects any other shape
(see the content contract below) instead of guessing what it meant.

### Content contract (build validation)

Before rendering anything, the build checks every file in `src/proyectos/`
(`lib/project-contract.js`) and refuses to publish content an editor could not
have saved:

- `title` and `text_es` are non-empty, `order` is a number, `featured` is a
  boolean, `gallery_columns` is 1 or 2 (the three-column variant included), and
  `variant` is `standard` or `three-column`;
- every media item has a `type` (`image` / `video`) and a `src` under the right
  assets folder; image sources (and video posters) use webp, jpg, jpeg, png,
  avif or gif, video sources use mp4 or webm;
- the master file each source names exists in `src/assets/images/` or
  `src/assets/videos/`;
- no project file still carries a key or per-item flag from the pre-CMS content
  that the schema replaced — the build names every one of them in the error
  message.

Every problem is reported in one build failure, naming the project file and the
field (gallery items are numbered from 1):

```text
Invalid project content (2 problems):
  - src/proyectos/penumbra.md: "order" must be a number (found: "primero")
  - src/proyectos/penumbra.md: media[2] ("/assets/images/foto.tiff"): "src" has an unsupported image format ".tiff"; use webp, jpg, jpeg, png, avif or gif
Fix the front matter under src/proyectos/ (.pages.yml describes each field).
```

`npm test` runs the same checks against throwaway content directories and
through a real Eleventy build, so each rule is proven to stop the build.

### About page

`src/acerca-de.md` is the About page. Its front matter keeps the biography in
two language fields plus the team:

```yaml
title: "Acerca de"
layout: about
bio_es: |-              # Spanish biography, required; rendered first
  ...
bio_en: |-              # English biography, optional; rendered after the divider
  ...
team: |-                # names, roles and the former-collaborators heading
  ...
```

The layout renders `bio_es`, then the `//` divider when `bio_en` has text, then
`bio_en`, with the team beside the biography. The divider comes from the shared
`divider` macro (`_includes/partials/divider.njk`) — the same markup the project
renderer uses — so no content file stores `//`. `team` stays one rich-text field
because the editors keep free-form control of names, roles and the
former-collaborators heading. The page keeps the site description as its
`<meta name="description">`.

## Pages CMS

`.pages.yml` (repository root) configures [Pages CMS](https://pagescms.org) 2.x.
Editors sign in at <https://app.pagescms.org>, pick a branch, and edit the
`proyectos` collection, the About page and the site settings; every save is a
commit on that branch. A commit on `main` triggers the deploy workflow and the
site is live about four minutes later. Labels and helper text are Spanish.

**There is no rendered page preview inside the CMS.** Editors review the live
site after the deploy. [`docs/editor-guide.md`](docs/editor-guide.md) is the
curator-facing workflow; [`docs/maintainer-checklist.md`](docs/maintainer-checklist.md)
covers installing the GitHub App, inviting editors and verifying the app on a
branch (all manual steps).

- `settings.content.merge: true` — keys outside the schema (`variant`) are
  preserved when an editor saves a project.
- The `proyectos` collection edits `src/proyectos` and excludes
  `proyectos.11tydata.json`, so the directory defaults never appear as a project.
- The filename field is visible on create and on edit and is seeded from the
  title (`{primary}.md`).
- The list view shows title, homepage status, order and dates, sorted by order.
- Three media sources write canonical paths into front matter, keep original
  filenames, and reject formats the site cannot publish: images
  (`src/assets/images` → `/assets/images`: WebP, JPG, JPEG, PNG, AVIF, GIF),
  videos (`src/assets/videos` → `/assets/videos`: MP4, WebM) and documents
  (`src/assets/files` → `/assets/files`: PDF).
- The gallery field (`media`) is a reorderable block list keyed by `type`
  (`image` / `video`): add an existing item or upload, reorder, remove, set alt
  text, choose a video poster, and toggle autoplay / loop / mute.
  `gallery_columns` stores the number of gallery columns (1 or 2).
- The text is two rich-text fields, `text_es` (Spanish, required) and `text_en`
  (English, optional), both Markdown with the editor/source switch and no media
  (the text lives in front matter, not in the Markdown body).
- The `about` entry edits `src/acerca-de.md`: `bio_es` (Spanish, required),
  `bio_en` (English, optional) and `team`, all Markdown rich text with the
  source switch and no media. `title` and `layout` stay out of the editor, so
  merge mode preserves them and the page keeps its layout on save.
- The schema covers the `proyectos` collection (title, venue, dates, both texts,
  homepage status, order, gallery columns and the gallery), the About file
  (`bio_es`, `bio_en`, `team`) and the site settings file (every key in
  `src/_data/site.json`, including the ones no template reads).

### Filename / URL change warning (limitation)

Pages CMS has no built-in warning when a filename change alters a public URL, and
no way to warn *at* the filename input. The configuration does the most the format
allows: the collection `description` and the `title` field `description` both state
that the filename is the public URL and that changing it breaks existing links.
The editor guide repeats the warning for the editors.

Because the app renders this copy, a maintainer confirms it in the hosted app on
a non-production branch — step 3 of
[`docs/maintainer-checklist.md`](docs/maintainer-checklist.md) — together with the
gallery editor, the upload restrictions, the About and settings saves, and
create/rename/delete.

Config changes are reviewable in Git and are read per branch, so a branch can be
tested before merging.

## CI/CD

`.github/workflows/deploy.yml` builds the site and publishes it to GitHub Pages
on every push to `main` (and manually via **Run workflow**).

**One-time setup:** in the repository, go to **Settings → Pages** and set the
source to **GitHub Actions**. The first push to `main` will publish the site.

### Configuration (repository variables)

| Variable | Default | Purpose |
|---|---|---|
| `PATH_PREFIX` | `/<repo>/` | Base path. `/` for a custom domain. |
| `SITE_URL` | `https://<owner>.github.io` | Origin used for canonical/OG/sitemap URLs. |
| `CUSTOM_DOMAIN` | _(unset)_ | When set, writes a `CNAME` file (e.g. `lava-mx.org`). |

Set these under **Settings → Secrets and variables → Actions → Variables**.

## Deploying to the custom domain (cutover runbook)

The site is designed to go live on a project subpath first, then switch to
`lava-mx.org` with no code changes.

1. **Verify the subpath deployment** at
   `https://<owner>.github.io/<repo>/` (desktop + mobile).
2. In **Settings → Variables**, set:
   - `PATH_PREFIX` = `/`
   - `SITE_URL` = `https://lava-mx.org`
   - `CUSTOM_DOMAIN` = `lava-mx.org`
   Then re-run the deploy workflow (**Actions → Deploy to GitHub Pages → Run workflow**).
3. In **Settings → Pages**, set **Custom domain** to `lava-mx.org` (the `CNAME`
   file is deployed automatically) and enable **Enforce HTTPS** once the
   certificate is issued.
4. At your DNS provider, point the domain at GitHub Pages:
   - Apex `lava-mx.org` → four **A** records:
     `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `www` → **CNAME** `lava-mx.org` (or `<owner>.github.io`)
   - Optional IPv6 (**AAAA**): `2606:50c0:8000::153`, `2606:50c0:8001::153`,
     `2606:50c0:8002::153`, `2606:50c0:8003::153`
5. Once `https://lava-mx.org` serves the new site and HTTPS is active, **cancel
   the Cargo subscription**.

> The migration scripts do not need to run again for deployment. `backup`,
> `extract`, and `fetch-assets` are one-time migration tools (the raw Cargo
> backup in `_cargo-export/` is git-ignored and kept only locally).

## Notes

- **Fonts:** Instrument Sans / JetBrains Mono are open-licensed substitutes for
  Cargo's licensed Diatype.
- **Old URLs:** the rebuild uses clean slugs and does not preserve the original
  Cargo URLs (see `MIGRATION-PLAN.md`).
- **Large assets:** image masters (~82 MB, up to 3200 px), videos (~18 MB) and
  dossier PDFs (~71 MB) are committed as-is; the responsive AVIF/WebP variants
  are generated at build time, so the build is image-heavy (~4 min locally).
