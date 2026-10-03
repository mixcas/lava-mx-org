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
| `npm run clean` | Remove the build output |
| `npm run backup` | Mirror the live Cargo site into `_cargo-export/` |
| `npm run extract` | Parse the backup into `src/proyectos/*.md`, `src/acerca-de.md`, site data |
| `npm run fetch-assets` | Download + optimize media, localize PDF dossiers |

```bash
npm install
npm run serve   # http://localhost:8080
```

## Project structure

```
src/
  _data/site.json              Site config (nav, emails, footer)
  _includes/layouts/           base / project / about / page layouts
  proyectos/<slug>.md          One file per exhibition (front matter + text)
  index.njk                    Home — current exhibitions
  proyectos.njk                /proyectos/ — past exhibitions index
  acerca-de.md                 About
  404.njk · sitemap.njk · robots.njk
  assets/                      css, fonts, images (masters), videos, files (PDFs)
scripts/
  backup.mjs                   Phase 0 — mirror Cargo
  extract.mjs                  Phase 1 — Cargo → Markdown/JSON
  fetch-assets.mjs             Phase 2 — download + optimize assets
.github/workflows/deploy.yml   Build + deploy to GitHub Pages
_cargo-export/                 Raw Cargo backup (git-ignored)
```

## Content model

Each project is a Markdown file in `src/proyectos/` with front matter:

```yaml
title: "Mineralia indisciplinada"
venue: "Museo Universitario del Chopo."
dates: "**Inauguración:** Octubre 23, 2025 — Marzo 2026"
current: true          # shown on the home page
order: 1               # sort order within current/past
slug: "mineralia-indisciplinada"
variant: standard      # or "three-column"
gallery_columns: 1     # 2 for a two-column gallery
media:                 # ordered images/videos (masters live in src/assets/images)
  - src: "DSC01858.webp"
  - src: "Reel_chopo_audio.mp4"
    video: true
    poster: "Mineralia-0143-B2766344.webp"
text: |-               # the bilingual body (ES // EN); rendered with Markdown
  ...
```

Images are referenced by their optimized master filename; `@11ty/eleventy-img`
generates the responsive variants at build time. Dossier PDFs live in
`src/assets/files/` and are linked with page-relative paths
(`../../assets/files/...`) so they work under any base path.

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
- **Large assets:** the dossier PDFs are committed as-is (~70 MB total).
