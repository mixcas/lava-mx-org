# lava-mx.org

Static site for [Lava](https://lava-mx.org), a curatorial collective in Mexico
City. Migrated from Cargo to an [Eleventy](https://www.11ty.dev/) site and
deployed to GitHub Pages.

## Stack

- **Eleventy v3** (Nunjucks templates, Markdown content)
- **@11ty/eleventy-img** for responsive AVIF/WebP images
- Self-hosted **Instrument Sans** + **JetBrains Mono** (OFL)
- Deployed via **GitHub Actions** to **GitHub Pages**

## Requirements

- Node **18+** and npm

## Commands

| Command | Description |
|---|---|
| `npm run serve` | Build and serve locally with live reload |
| `npm run build` | Build the site into `_site/` |
| `npm test` | Build once and assert the generated site (`test/site.test.mjs`) |
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
media:                  # ordered images/videos (masters live in src/assets/images)
  - src: "DSC01858.webp"
  - src: "Reel_chopo_audio.mp4"
    video: true
    poster: "Mineralia-0143-B2766344.webp"
text: |-                # the bilingual body (ES // EN); rendered with Markdown
  ...
```

Only non-default values appear: `variant: three-column` (Infernal Natures) and
`gallery_columns: 2` (Lianas Neotropicales). The file name is the public URL:
`src/proyectos/penumbra.md` → `/proyectos/penumbra/`. There is no `slug` key.

Images are referenced by their optimized master filename; `@11ty/eleventy-img`
generates the responsive variants at build time. Dossier PDFs live in
`src/assets/files/` and are linked with page-relative paths
(`../../assets/files/...`) so they work under any base path.

## Pages CMS

`.pages.yml` (repository root) configures [Pages CMS](https://pagescms.org) 2.x.
Editors sign in at <https://app.pagescms.org>, pick a branch, and edit the
`proyectos` collection; every save is a commit on that branch, which triggers the
deploy workflow. Labels and helper text are Spanish.

- `settings.content.merge: true` — keys outside the schema (gallery, text) are
  preserved when an editor saves a project.
- The `proyectos` collection edits `src/proyectos` and excludes
  `proyectos.11tydata.json`, so the directory defaults never appear as a project.
- The filename field is visible on create and on edit and is seeded from the
  title (`{primary}.md`).
- The list view shows title, homepage status, order and dates, sorted by order.
- The schema decided in `.pages.yml` currently covers title, venue, dates,
  homepage status and order. Gallery and text fields are added by later work.

### Filename / URL change warning (limitation)

Pages CMS has no built-in warning when a filename change alters a public URL, and
no way to warn *at* the filename input. The configuration does the most the format
allows: the collection `description` and the `title` field `description` both state
that the filename is the public URL and that changing it breaks existing links.

**A maintainer must verify this in the hosted app** (it cannot be checked from the
repository, because it needs a signed-in session):

1. Open the repository on a non-production branch.
2. Confirm the collection description is visible on the project list and/or entry.
3. Confirm the `title` field's helper text appears when creating and when editing.
4. Confirm the filename input shows on create (pre-filled from the title) and on
   edit (locked until unlocked).
5. If the collection description is *not* rendered by the app, move the warning
   into the field descriptions only, and record the finding in the editor handoff.

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
