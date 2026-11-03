# lava-mx.org

Static site for [Lava](https://lava-mx.org), a curatorial collective in Mexico
City. Migrated from Cargo to an [Eleventy](https://www.11ty.dev/) site and
deployed to GitHub Pages.

The site is published in two language versions. Spanish is the default and
stays at the root (`/`, `/proyectos/`, `/proyectos/<slug>/`, `/acerca-de/`), so
no existing URL changes; English is mirrored under `/en/` with the same path
segments and the same slug (`/en/`, `/en/proyectos/`,
`/en/proyectos/<slug>/`, `/en/acerca-de/`). One content file per page carries
both versions (see [Language versions](#language-versions)).

## Documentation

- [`docs/editor-guide.md`](docs/editor-guide.md) — curator guide (Spanish):
  signing in with the invitation, finding and editing a project, the two
  language versions and when English can stay empty, the gallery and its two
  alt texts, the About page, the site settings, publishing, waiting for the
  deploy, and the filename/URL warning.
- [`docs/maintainer-checklist.md`](docs/maintainer-checklist.md) — installing
  the Pages CMS GitHub App, inviting editors by email, verifying the CMS on a
  non-production branch, merging to production, and the rules the build now
  enforces on content. App installation and invitations are **manual maintainer
  actions**.
- [`GLOSSARY.md`](GLOSSARY.md) — the domain vocabulary: language version,
  untranslated field, neutral value, project, homepage project, archive project,
  gallery, media item, media source, site settings, and the editor and
  maintainer roles.
- [`docs/adr/0001-pages-cms.md`](docs/adr/0001-pages-cms.md) — the Pages CMS
  decision and its trade-offs.
- [`docs/adr/0002-per-language-pages.md`](docs/adr/0002-per-language-pages.md) —
  one page per language: Spanish at the root and English under `/en/`, the
  `es` / `en` content model, the silent fallback and translation tracker, the
  metadata, and the retirement of the `//` divider.
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
| `npm test` | Build once and assert both language trees, the content contract and the translation tracker (`test/*.test.mjs`) |
| `npm run clean` | Remove the build output |
| `npm run backup` | One-time Cargo migration: mirror the live Cargo site into `_cargo-export/` |
| `npm run extract` | One-time Cargo migration: parse the backup into `src/` content and site data |
| `npm run fetch-assets` | One-time Cargo migration: download + optimize media, localize PDF dossiers |

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
the generated HTML with `node-html-parser` and asserts the public behaviour. One
source page yields two routes, so the build produces the fifteen routes in both
languages — thirty pages — plus `404.html`, `sitemap.xml` and `robots.txt`.

- every Spanish route and its `/en/` mirror exist, with the same path segments
  and slug, and `<html lang>` matches the route;
- the chrome (navigation label, header links, footer, headings) is in the
  page's language, and the header carries one language link to the counterpart
  page;
- homepage and `/en/` membership and order, `/proyectos/` and `/en/proyectos/`
  membership and order, the About page, and each project's title, venue, dates,
  text and gallery in the page's language;
- an English page of an untranslated project shows that page's Spanish text,
  marked `lang="es"`, with no notice — and neither language version ever carries
  the other one's text;
- `hreflang` for `es`, `en` and `x-default` (the Spanish URL), `og:locale` and
  `og:locale:alternate`, a self canonical, and a sitemap listing every built
  page with `xhtml:link` alternates;
- the content contract: the project directory defaults, the `es` / `en` front
  matter, that no project file carries a legacy flat key, and that
  `.pages.yml` still declares the collections the editors depend on.

`test/project-contract.test.mjs` covers build-time validation: the migrated
content passes, and each broken rule (a missing `es.title`, a non-numeric
`order`, a blank English value, a legacy key, a bad media item, a missing
master…) fails a real build with a message naming the file and the field. It
also pins the translation tracker: which fields it lists, and that it prints
during a build without failing it. `test/project-view.test.mjs` pins the view
model's language-aware reading of projects and media items. `test/docs.test.mjs`
checks that the handoff documents exist, are linked from this README, and do not
teach the retired flat keys or the divider.

Expectations live in `test/support/projects.mjs` as editorial facts about the
live site, not as a copy of the templates. Failures name the page and the
assertion, for example
`page /en/proyectos/penumbra/: gallery images rendered`.

The suite builds twice: the primary build under `PATH_PREFIX` (the root when it
is unset) and a second build under `/lava-mx-org/` in a child process, so every
run also checks the subpath deployment — including that English pages, the
language links and the hreflang URLs carry the prefix. Both reuse the
`_site/img` cache. The primary build honours the same variables as
`npm run build`, so the suite can be run for another subpath or origin:

```bash
PATH_PREFIX=/lava-mx-org/ SITE_URL=https://example.github.io npm test
```

When `PATH_PREFIX` is already `/lava-mx-org/`, both builds are the same and the
suite builds once.

In CI, run it after `npm ci` with the same `PATH_PREFIX` / `SITE_URL` values
used for the deploy build (see `.github/workflows/deploy.yml`), and cache
`_site/img` between runs as the deploy workflow already does.

## Project structure

```
src/
  _data/languages.json         The site's languages: code, route prefix, OG locale, label
  _data/site.json              Site settings: language-neutral data + the es / en chrome
  _includes/layouts/           base / project / about / page layouts
  _includes/partials/          project rendering: the project page and the project listing
  proyectos/<filename>.md      One file per project (es / en front matter + media)
  proyectos/proyectos.11tydata.json  Directory defaults shared by every project
  index.njk                    / and /en/ — Homepage projects
  proyectos.njk                /proyectos/ and /en/proyectos/ — Archive projects
  acerca-de.md                 /acerca-de/ and /en/acerca-de/ — About
  404.njk · sitemap.njk · robots.njk
  assets/                      css, fonts, images (masters), videos, files (PDFs)
lib/
  languages.js                 Language registry: route → language versions, hreflang, sitemap entries
  routes.js                    Route keys → routes, inside a language
  project-view.js              Canonical, language-aware project view model
  project-contract.js          Content contract + translation tracker
  front-matter.js · media-assets.js · path-prefix.js
scripts/                       One-time Cargo migration tools (backup, extract, fetch-assets)
test/
  site.test.mjs                Generated-site assertions (`npm test`)
  project-contract.test.mjs    Build-time validation rules + translation tracker
  project-view.test.mjs        View model's language-aware reading of projects
  docs.test.mjs                Handoff documents exist, are linked, are committed
  support/                     Build-once harness + editorial fixture facts
.github/workflows/deploy.yml   Build + deploy to GitHub Pages
_cargo-export/                 Raw Cargo backup (git-ignored)
```

## Languages

`src/_data/languages.json` declares the site's language versions, Spanish first:

```json
[
  { "code": "es", "prefix": "", "locale": "es_MX", "label": "Español" },
  { "code": "en", "prefix": "/en", "locale": "en_US", "label": "English" }
]
```

- `prefix` is the route prefix of that language's tree, `locale` its Open Graph
  locale, and `label` the name it goes by in its own language — the text of the
  counterpart page's language link.
- Every page template with two versions paginates over this list (a
  `pagination` on `data: languages` with the alias `lang`, and a `permalink`
  built from `lang.prefix`), so one source file yields one page per language.
  The project directory defaults carry that pagination, so a new project file
  gets both routes without any per-file setting.
- The language of a page is read from its route, never stored in content. A
  *route* is a URL without its language prefix: `/proyectos/` and
  `/en/proyectos/` are the same route. `lib/languages.js` builds the registry of
  routes from the pages Eleventy actually built, and the language link, the
  `hreflang` set and the sitemap read that registry — so a route gains its
  alternates in the same build that builds them, and a route built in one
  language alone advertises nothing else.
- English keeps the Spanish path segments (`/en/proyectos/`, not
  `/en/projects/`): the file name defines the slug of both versions, so the URL
  stays predictable. Nothing about the deployment path prefix changes — see
  [CI/CD](#cicd).

## Content model

### Project directory defaults

`src/proyectos/proyectos.11tydata.json` is an Eleventy directory data file: it
applies to every Markdown file in `src/proyectos/`, including projects an editor
creates later. It supplies

```json
{
  "layout": "project",
  "variant": "standard",
  "featured": false,
  "order": 0,
  "gallery_columns": 1,
  "pagination": { "data": "languages", "size": 1, "alias": "lang", "resolve": "values", "addAllPagesToCollections": true },
  "permalink": "{{ lang.prefix }}/proyectos/{{ page.fileSlug }}/"
}
```

so a project file only carries values that differ from those defaults.

### Front matter

Each project is one Markdown file in `src/proyectos/` carrying both language
versions as an `es` object and an optional `en` object:

```yaml
es:                     # the Spanish language version: required
  title: "Mineralia indisciplinada"   # required; names the file and both URLs
  venue: "Museo Universitario del Chopo."   # optional
  dates: "**Inauguración:** Octubre 23, 2025 — Marzo 2026"   # optional, Markdown
  text: |-              # required, Markdown
    ...
en:                     # optional; an absent object means untranslated
  title: "Mineralia indisciplinada"
  text: >-
    ...
featured: true          # homepage project; omitted (false) means archive project
order: 1                # position within its group (homepage or archive)
media:                  # one ordered gallery, shared by both versions
  - type: image
    src: "/assets/images/587715752_1242916567868994_3097586358400451986_n.webp"
    alt_es: "Sala principal"   # optional
    alt_en: "Main room"        # optional
  - type: video
    src: "/assets/videos/Reel_chopo_audio.mp4"
    poster: "/assets/images/Mineraliaindisciplinada-0143-B2766344.webp"   # optional
    # autoplay / loop / mute: only written when enabled
```

`venue` and `dates` are optional inside `es` too (one project has no venue). The
two texts are never stacked on one page and no file stores a separator:
`es.text` renders on the Spanish page and `en.text` on the English one.

Only non-default values appear: `variant: three-column` (Infernal Natures) and
`gallery_columns: 2` (Lianas Neotropicales). The file name comes from the
slugified Spanish title — `Corteza Líquida` → `src/proyectos/corteza-liquida.md`
— and defines both public URLs, `/proyectos/corteza-liquida/` and
`/en/proyectos/corteza-liquida/`. There is no `slug` key, and `en.title` never
affects either URL.

The listing pages set a page-level `hero` flag in their own front matter —
`hero: featured` on the homepage (`index.njk`), `hero: archive` on
`/proyectos/` (`proyectos.njk`). It names the collection whose first image
becomes the page's preloaded LCP image and social image; a project page uses its
own first gallery image instead.

### Language versions

One entry per project, every page built twice:
[`docs/adr/0002-per-language-pages.md`](docs/adr/0002-per-language-pages.md).

- **The Spanish object is the content.** `es.title` and `es.text` are required;
  `es.venue` and `es.dates` are optional.
- **The English object is optional at every level.** Where an English value is
  absent, the English page shows the Spanish value silently — an
  [untranslated field](GLOSSARY.md), with no notice on the page. A body that
  fell back this way is marked `lang="es"`, so a screen reader still pronounces
  it as Spanish.
- **Writing an English value equal to the Spanish one is a
  [neutral value](GLOSSARY.md)** — the editor's way of saying "looked at it, it
  is the same in both". The build then stops listing that field.
- **Everything else is shared** by the two versions: the gallery, `featured`,
  `order`, `gallery_columns` and `variant`. An image is uploaded and ordered
  once and described twice, with `alt_es` and `alt_en`; on an English page its
  alt text resolves the English alt, then the project's English title, then the
  Spanish title (the Spanish page uses `alt_es`, then the Spanish title). An
  older language-neutral `alt` is rejected as a legacy media key, with a
  message pointing at `alt_es` and `alt_en`.
- **The view model is the only reader of content.**
  `lib/project-view.js` resolves every field for the language a page was built
  in and records, per field, whether the value is a fallback; no template reads
  front matter shapes directly. The About page's three fields go through the
  same fallback rule through the `localizedText` filter
  (`lib/languages.js`).

`variant: three-column` is the archived Infernal Natures layout and the only
place it is written: it is not part of the Pages CMS schema, so the editor never
shows it and merge mode keeps it on save. That project's gallery is one ordered
list like every other project's; the template splits it in half for the
three-column layout — the first column takes the first half rounded up, the
second column takes the rest (`lib/project-view.js` computes `splitAt`).

Each media item is typed: an image has a `src` and optional `alt_es` /
`alt_en`, a video has a `src`, optional `poster`, and `autoplay` / `loop` /
`mute` flags. Sources are canonical asset paths — `/assets/images/…` for images
(masters in `src/assets/images/`), `/assets/videos/…` for videos,
`/assets/files/…` for documents. `lib/project-view.js` normalizes those paths to
the master basename the image pipeline reads. Images are processed by
`@11ty/eleventy-img` into the responsive variants at build time. Dossier PDFs
live in `src/assets/files/` and are linked root-relative
(`/assets/files/...`); the build applies the deployment path prefix
(`lib/path-prefix.js`), so they work under any base path — and a PDF can be
linked from either language's text.

### Translation tracker

Before rendering, the build lists every project field whose English value is
absent — the editorial to-do list, and the only translation-status view (Pages
CMS cannot show one):

```text
Untranslated English values (12 projects):
  - src/proyectos/corteza-liquida.md: en.venue, en.dates
  - src/proyectos/infernal-natures.md: en.title, en.venue, en.dates, en.text
  …
```

It covers `en.title`, `en.venue`, `en.dates` and `en.text` of every project,
lists a field only when the Spanish version writes it (a project with no venue
is not asked for `en.venue`), and does not track `alt_en` (an image's alt has
its own fallback chain). It prints during every build that has something to
report, including the quiet build `npm test` runs, and **never fails the
build**: an untranslated project builds and deploys normally. The About page and
the site settings are not part of it.

### Content contract (build validation)

Before rendering anything, the build checks every file in `src/proyectos/`
(`lib/project-contract.js`) and refuses to publish content an editor could not
have saved:

- the file has front matter with an `es` object: `es.title` and `es.text` are
  non-empty strings, and every value written in `es` is text;
- the `en` object, when present, is an object, every value written in it is a
  string, and **no English value is blank** — `en.title`, `en.venue`,
  `en.dates`, `en.text` and a media item's `alt_en` all refuse whitespace, since
  a blank field would claim a translation the page does not have. Leaving the
  field out is what "untranslated" means;
- `order` is a number, `featured` is a boolean, `gallery_columns` is 1 or 2 (the
  three-column variant included), and `variant` is `standard` or
  `three-column`;
- every media item has a `type` (`image` / `video`) and a `src` under the right
  assets folder; image sources (and video posters) use webp, jpg, jpeg, png,
  avif or gif, video sources use mp4 or webm;
- the master file each source names exists in `src/assets/images/` or
  `src/assets/videos/`;
- no project file still carries a key from the superseded shapes — `title`,
  `venue`, `dates`, `text`, `text_es`, `text_en`, `bio`, `current`, `slug`,
  `layout`, `media_left`, `media_middle` — or a per-item `video` / `muted`
  flag. The build rejects each one by name and says what replaced it.

Every problem is reported in one build failure, naming the project file and the
field (gallery items are numbered from 1):

```text
Invalid project content (2 problems):
  - src/proyectos/penumbra.md: the legacy "text_es" key is not part of a project; use "es.text"
  - src/proyectos/penumbra.md: media[2] ("/assets/images/foto.tiff"): "src" has an unsupported image format ".tiff"; use webp, jpg, jpeg, png, avif or gif
Fix the front matter under src/proyectos/ (.pages.yml describes each field).
```

`npm test` runs the same checks against throwaway content directories and
through a real Eleventy build, so each rule is proven to stop the build.

### About page

`src/acerca-de.md` is the About page, paginated over the site's languages:
`/acerca-de/` in Spanish and `/en/acerca-de/` in English. Its front matter
carries the two versions the same way a project's does:

```yaml
layout: about
pagination:
  data: languages
  size: 1
  alias: lang
  resolve: values
  addAllPagesToCollections: true
permalink: "{{ lang.prefix }}/acerca-de/"
eleventyComputed:
  title: "{{ { es: es, en: en } | localizedText(lang.code, 'title') }}"
es:                     # required
  title: "Acerca de"
  bio: |-               # Spanish biography
    ...
  team: |-              # names, roles and the former-collaborators heading
    ...
en:                     # optional
  title: "About"
  bio: |-               # English biography
    ...
  team: |-              # English names, roles and heading
    ...
```

The layout renders that language version's own biography and team list, each
through `localizedText`: with no English written, the English page shows the
Spanish text, silently. Each team list stays one rich-text field so editors keep
free-form control of names, roles and the former-collaborators heading, in that
language only. The page heading is visually hidden, and the page keeps the site
description of its language as its `<meta name="description">`.

### Site settings

`src/_data/site.json` holds the data every page shares. Language-neutral values
stay at the top; the chrome text lives in an `es` object and an `en` object with
the same fields:

```json
{
  "title": "Lava",
  "email": "hola@lava-mx.org",
  "contactEmail": "info.lavamx@gmail.com",
  "contactName": "info.lavamx",
  "url": "https://lava-mx.org", "instagram": "lava__mx", "city": "Ciudad de México",
  "social": { "instagram": "…" },
  "es": {
    "description": "…", "navLabel": "Principal",
    "homeHeading": "Lava — proyectos actuales", "archiveHeading": "Proyectos anteriores",
    "notFound": { "message": "La página que buscas no existe.", "link": "Volver al inicio" },
    "footer": { "copyright": "©LAVA", "city": "Ciudad de México", "instagram": "@lava__mx" },
    "nav": { "about": { "label": "Lava es", "route": "about" },
             "projects": { "label": "Proyectos anteriores", "route": "projects" } }
  },
  "en": {
    "description": "…", "navLabel": "Main",
    "homeHeading": "Lava — current projects", "archiveHeading": "Previous projects",
    "notFound": { "message": "The page you are looking for does not exist.", "link": "Back to the start" },
    "footer": { "copyright": "©LAVA", "city": "Mexico City", "instagram": "@lava__mx" },
    "nav": { "about": { "label": "Lava is", "route": "about" },
             "projects": { "label": "Previous projects", "route": "projects" } }
  }
}
```

- `description` is the homepage's `<meta name="description">` and social
  description; `homeHeading` and `archiveHeading` are the visually hidden page
  headings (the archive's is also its `<title>`); `navLabel` names the header
  navigation for screen readers; `footer` is the footer text; `notFound` is the
  404 page's line and back-link label.
- A navigation entry stores a **route key**, not a URL. `lib/routes.js` maps
  `about` → `/acerca-de/` and `projects` → `/proyectos/`, and the template
  prepends the language's prefix, so the Spanish header links to `/acerca-de/`
  and the English one to `/en/acerca-de/`. The address is written in one place
  and gains the deployment prefix like every other URL.
- Unlike project and About content, the chrome has **no silent fallback**: a
  page reads `site[<its language>]` directly, so a blank English value renders
  blank. The editor's descriptions say which fields must be filled in both
  languages (`notFound`, which appears on the single 404 page, is required in
  both). The build does not fail on the settings.

### Metadata and the 404 page

- Every page built in both languages declares `hreflang` for `es`, `en` and
  `x-default` (the Spanish URL), `og:locale` from `languages.json` (`es_MX` /
  `en_US`) with `og:locale:alternate` for the other language, and a canonical
  pointing at itself — so the two versions are not treated as duplicates. A
  route built in one language alone declares no alternates and no counterpart.
- `sitemap.xml` lists one `<url>` per built language version with `xhtml:link`
  alternates; `robots.txt` still advertises that one sitemap.
- `<title>` and the meta description come from the page's own language version:
  a project page uses its own title and the start of its own body, the About
  page its own title and the start of its own biography (the Spanish ones only
  when the English version is unwritten), and a page with neither text falls
  back to the site description of its language.
- Each page's header carries one plain anchor to the counterpart page, labelled
  in that language ("English" / "Español"); it is rendered only when that page
  was built. There is no auto-detection, cookie or script.
- `404.html` is the one page that cannot know which language was wanted, so it
  is the only one that speaks both: Spanish chrome (its `<title>` included, from
  `site.es.notFound.title`), `<html lang="es">`, and one short line per language
  — each marked with its own `lang` and linking to that language's homepage.
- The header navigation is a grid of one equal column per item, so the pages
  without a Language link (the 404) get four columns rather than an empty fifth.

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
- `settings.commit.identity: user` — every save is committed under the editor's
  own name and email. The push still uses the GitHub App installation token, so
  the deploy is unaffected.
- The `proyectos` collection edits `src/proyectos` and excludes
  `proyectos.11tydata.json`, so the directory defaults never appear as a project.
- Each entry is presented as two labelled objects, **Versión en español** first
  and **Versión en inglés** second. The Spanish one is the only required content
  (title and text); every English field is optional, and a field left empty
  renders the Spanish value.
- The filename field is visible on create and on edit and is seeded from the
  Spanish title (`{primary}.md`, `primary: es.title`).
- The list view shows `es.title`, homepage status, order and `es.dates`, sorted
  by order. It cannot show translation status: Pages CMS renders one column per
  declared field and has no secondary line, so the build's tracker is the only
  status view.
- Three media sources write canonical paths into front matter, keep original
  filenames, and reject formats the site cannot publish: images
  (`src/assets/images` → `/assets/images`: WebP, JPG, JPEG, PNG, AVIF, GIF),
  videos (`src/assets/videos` → `/assets/videos`: MP4, WebM) and documents
  (`src/assets/files` → `/assets/files`: PDF).
- The gallery field (`media`) is one reorderable block list keyed by `type`
  (`image` / `video`), shared by both language versions: add an existing item or
  upload, reorder, remove, set `alt_es` / `alt_en`, choose a video poster, and
  toggle autoplay / loop / mute. `gallery_columns` stores the number of gallery
  columns (1 or 2).
- Both texts are rich-text fields inside the language objects (`es.text`,
  `en.text`), Markdown with the editor/source switch (the text lives in front
  matter, not in the Markdown body). Both offer the documents library, so an
  editor can upload a PDF while writing and link to it from either language; no
  other media is inserted.
- The `about` entry edits `src/acerca-de.md` as the same two objects: `es` with
  a required `title`, `bio` and `team`, `en` with the same three optional
  fields, all Markdown rich text with the source switch and the documents
  library. `layout` stays out of the editor, so merge mode preserves it and the
  page keeps its layout on save.
- The `site` entry edits `src/_data/site.json`: the language-neutral values at
  the top, then **Versión en español** and **Versión en inglés** with the same
  fields each (description, navigation label, homepage and archive headings, the
  404 copy, the footer and the two navigation labels with their route keys).
  Every key in the file is exposed, including the ones no template reads, so a
  save never drops a setting.
- The schema covers the `proyectos` collection (the two language objects, both
  texts, homepage status, order, gallery columns and the gallery), the About
  file and the site settings file.

### Filename / URL change warning (limitation)

Pages CMS has no built-in warning when a filename change alters a public URL, and
no way to warn *at* the filename input. The configuration does the most the format
allows: the collection `description` and the `es.title` field `description` both
state that the filename is the public URL and that changing it breaks existing
links. The editor guide repeats the warning for the editors.

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
| `SITE_URL` | `https://<owner>.github.io` | Origin used for canonical/OG/hreflang/sitemap URLs. |
| `CUSTOM_DOMAIN` | _(unset)_ | When set, writes a `CNAME` file (e.g. `lava-mx.org`). |

`PATH_PREFIX` applies to both language trees: the prefix is added to every URL
the site owns, so under `/lava-mx-org/` the English homepage is
`/lava-mx-org/en/`, its language links, hreflang URLs and sitemap entries
included. `SITE_URL` is the origin those absolute URLs are built from. Neither
is stored in content, and nothing else about the subpath support changes.

Set these under **Settings → Secrets and variables → Actions → Variables**.

## Deploying to the custom domain (cutover runbook)

The site is designed to go live on a project subpath first, then switch to
`lava-mx.org` with no code changes.

1. **Verify the subpath deployment** at
   `https://<owner>.github.io/<repo>/` (desktop + mobile), including `/en/`.
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
> backup in `_cargo-export/` is git-ignored and kept only locally), and the
> content they wrote was restructured into the `es` / `en` model afterwards.

## Notes

- **Fonts:** Instrument Sans / JetBrains Mono are open-licensed substitutes for
  Cargo's licensed Diatype.
- **English URLs:** English pages live under the Spanish path segments
  (`/en/acerca-de/`, `/en/proyectos/<slug>/`) on purpose: the file name defines
  both URLs, and the live Spanish URLs stay untouched.
- **Old URLs:** the rebuild uses clean slugs and does not preserve the original
  Cargo URLs (see `MIGRATION-PLAN.md`).
- **Large assets:** image masters (~82 MB, up to 3200 px), videos (~18 MB) and
  dossier PDFs (~71 MB) are committed as-is; the responsive AVIF/WebP variants
  are generated at build time, so the build is image-heavy (~4 min locally).
