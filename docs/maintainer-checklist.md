# Pages CMS — maintainer checklist

How to turn on editing for the curators and check it before editors rely on it.
The curators themselves read [`docs/editor-guide.md`](editor-guide.md); this file
is the maintainer half: app installation, invitations, branch verification, the
production merge, and the checks the build now runs on content.

The CMS is configured by `.pages.yml` at the repository root and read per
repository **and per branch**. Nothing here is installed in the repository: the
app, the GitHub App installation and the collaborator records live in Pages CMS.
The configuration itself is committed and reviewable like any other file.

Steps marked **(manual)** cannot be done from this repository — they need a
signed-in GitHub session in the hosted app.

## 0. Where the site stands

The bilingual migration is complete, so this checklist assumes the current
model, not the one it replaced:

- **Content:** every Project and the About page carry an `es` object and an
  optional `en` object in one file; the gallery is one shared list with `alt_es`
  / `alt_en`; the site settings hold language-neutral data plus `es` / `en`
  chrome. The flat `text_es` / `text_en` / `bio_es` / `bio_en` / single-`team`
  / `media_left` / `media_right` keys and the `//` divider are gone — the build
  rejects the old keys by name.
- **Routes:** each page is built twice, Spanish at its original URL and English
  under `/en/` with the same segments and slug
  ([`docs/adr/0002-per-language-pages.md`](adr/0002-per-language-pages.md)).
- **Metadata:** every page built in both languages declares `hreflang` (`es`,
  `en`, `x-default` → the Spanish URL), `og:locale` / `og:locale:alternate` and a
  self canonical; the sitemap lists both versions with `xhtml:link` alternates.
- **Translation:** optional, never blocking. The build prints what is left to
  translate and keeps going.

The two historical documents stay as they are: `MIGRATION-PLAN.md` describes the
Cargo import and ADR-0001 records the Pages CMS decision. ADR-0002 supersedes
ADR-0001's `text_es` / `text_en` naming only.

## 1. Install the Pages CMS GitHub App **(manual)**

1. Open <https://app.pagescms.org> and sign in **with GitHub** as a user who
   administers `mixcas/lava-mx-org`.
2. Install the Pages CMS GitHub App on the account or organization that owns the
   repository, and grant it access to **this repository only**.
3. Open `mixcas/lava-mx-org` in the app. The app reads `.pages.yml` from the
   repository root and shows **Proyectos**, **Acerca de** and **Ajustes del
   sitio** in the sidebar.

The installation grants the app the repository access it needs (contents and
administrative permissions, plus Actions so it can show build status). No OAuth
worker, API server or database is added to this project.

If the sidebar shows no collections, the app is reading a branch where
`.pages.yml` is missing — switch to `main`.

## 2. Invite the editors by email **(manual)**

1. In Pages CMS, open the repository's collaborator settings.
2. Add each curator's email address. They do not need a GitHub account.
3. Tell the editor the branch to use (normally `main`), and point them to
   [`docs/editor-guide.md`](editor-guide.md).

Notes:

- Collaborators are stored in the Pages CMS database, **not** in `.pages.yml`.
  If Pages CMS is ever replaced or migrated, export/import the collaborator list
  separately.
- Collaborators can open the repository and edit content and media. They cannot
  change `.pages.yml` or manage other collaborators — those stay with GitHub
  users who have repository access.
- Collaborator writes push with the GitHub App installation token, and
  `settings.commit.identity: user` makes each commit authored by the editor who
  saved it, with the name and email from their Pages CMS account — the push still
  uses the installation token, so the deploy is unaffected. The commit message
  and the file path identify the change; `git log` is the audit trail.

## 3. Verify the CMS on a non-production branch **(manual)**

Never hand the CMS over without this pass: the gallery editor, the media browser
and the upload restrictions exist only in the hosted app and cannot be exercised
from the repository.

1. Create a branch from `main` (for example `cms-verification`) and push it.
2. In Pages CMS, switch to that branch and confirm the configuration loads:
   collections, field labels and helper text in Spanish, and the project list
   showing the Spanish title, homepage status, order and Spanish dates.
3. **Project form**
   - Open a project: **Versión en español** comes first with title, venue, dates
     and text; **Versión en inglés** comes second with the same four, none of
     them marked required.
   - Confirm **no** English field is required: save a project with the whole
     English block empty and confirm it saves and publishes.
   - Confirm the filename input is visible — pre-filled from the Spanish title
     when creating, locked until unlocked when editing.
   - Confirm the URL warning is visible: the collection description and the
     `Título en español` field helper text both say the filename is the public
     URL. If the app does not render the collection description, move that
     warning into the field descriptions and update the editor guide.
   - Confirm `variant` is nowhere in the form (three-column stays
     developer-only).
4. **Gallery editor**
   - Add an existing image from the media library.
   - Upload a new image.
   - Add a video, choose a poster, and toggle autoplay / loop / mute.
   - Set **Texto alternativo en español** and **Texto alternativo en inglés** on
     an image; leave one empty to see the title fallback on the deployed page.
   - Drag items to reorder and remove one item.
   - Save and confirm the committed front matter keeps canonical paths
     (`/assets/images/…`, `/assets/videos/…`), the original filenames, the item
     order and one shared `media` list (not one per language).
   - Set **Columnas de la galería** to 1 and to 2 and confirm a number is saved.
5. **Upload restrictions** — try an unsupported format (SVG or TIFF for images,
   MOV for video) and confirm the media source rejects it. This is deliberate:
   only WebP, JPG, JPEG, PNG, AVIF and GIF images, MP4 and WebM videos and PDF
   documents are publishable.
6. **Language blocks** — write a project's `es` and `en` texts, save, and confirm
   they land as `es: { title, …, text }` and `en: { …, text }` in front matter
   (not in the Markdown body), with no flat key beside them. Confirm the About
   page saves as `es` / `en` objects with `title`, `bio` and `team`, and that
   `layout` is not editable and survives the save. Upload a PDF from the insert
   button in the Spanish text and confirm the link points at
   `/assets/files/…` and the file lands in `src/assets/files/`; do the same from
   the English text.
7. **Site settings** — change one value that reaches the site (for example the
   Spanish footer city) and one that does not (for example *Dirección del
   sitio*), save, and confirm both survive and the description says which one
   has no effect. Confirm the `es` and `en` objects both render, that each
   navigation label keeps its route key (`about`, `projects`) rather than a URL,
   and that the two language versions keep their own labels.
8. **Create, rename, delete** — create a test project (the filename is seeded
   from the Spanish title), rename it, then delete it. Renaming must move both
   URLs (`/proyectos/<slug>/` and `/en/proyectos/<slug>/`).
9. **Merge mode** — open `infernal-natures.md`, save without changing anything,
   and confirm the file still carries `variant: three-column` and no unmanaged
   key was dropped.
10. **Commits land on the branch** — confirm every save above produced a commit
    on `cms-verification`, that `main` is untouched, and that the commit author
    is the editor who saved it (their name and email, not the Pages CMS app).
11. Run the suite on the branch before merging:

    ```bash
    npm ci
    npm test
    PATH_PREFIX=/lava-mx-org/ SITE_URL=https://example.github.io npm test
    ```

    `npm test` builds the site and checks the content contract, so a save that
    produces content the build rejects fails here rather than on production.

12. Discard the verification branch (or keep it if you want a review trail).
    The deploy workflow only runs on `main`, so nothing was published.

## 4. Merge to production **(manual)**

1. Merge the verified configuration/content to `main`.
2. The push to `main` triggers **Deploy to GitHub Pages**; the run takes about
   **four minutes**. Watch it under **Actions**.
3. Read the build log's **translation tracker** (see
   [What the build checks](#5-what-the-build-checks)). It is informational; the
   deploy succeeded regardless of what it lists.
4. Open the live site in a private window:
   - the homepage shows the selected homepage projects in order, in Spanish;
   - `/proyectos/` shows every other project in order;
   - a project page shows its own language's title, venue, dates, text and
     gallery — Spanish at `/proyectos/<slug>/`, English at
     `/en/proyectos/<slug>/` — and an untranslated English page shows the
     Spanish text, still legible and marked as Spanish in the page source;
   - the header's language link goes to the same page in the other language,
     not to the other language's homepage;
   - `/acerca-de/` and `/en/acerca-de/` each show their own biography and team
     list;
   - a page served at a non-existent address shows the 404 page with one line
     in Spanish and one in English;
   - the page source declares `<html lang>`, `hreflang`, `og:locale` and a
     self canonical; `/sitemap.xml` lists both versions with `xhtml:link`
     alternates;
   - gallery images render responsively and videos play with their poster and
     flags, and every video shows the browser's control bar unless autoplay,
     mute and loop are all ticked;
   - a dossier link still resolves, including under a subpath deployment.
5. Confirm the behavior in the app once more against `main` (the configuration is
   read per branch, so a branch-only edit is not in effect on production).

## 5. What the build checks

Two checks run before anything renders (`eleventy.config.js`, `lib/`).

**The content contract fails the build** with a message naming the project file
and the field. The rules:

- `es.title` and `es.text` are required and non-empty; `es.venue` and
  `es.dates` are optional (one project has no venue);
- every value written in `es` or `en` is text; the `en` object is optional at
  every level, but **no English value may be blank** — a blank `en.title`,
  `en.venue`, `en.dates`, `en.text` or `alt_en` would claim a translation the
  page does not have. Clearing the field in the CMS deletes it, which is the
  state "untranslated" means;
- the old flat keys are **rejected by name**, each with the replacement:
  `title` / `venue` / `dates` / `text` → `es.*`, `text_es` → `es.text`,
  `text_en` → `en.text`, `bio` → `es.text`, `media_left` / `media_middle` → one
  ordered `media` list, `current` → `featured`, `slug` → the file name,
  `layout` → the directory defaults; a per-item `video` / `muted` flag is
  rejected in the same way;
- the remaining rules are unchanged: numeric `order`, boolean `featured`,
  `gallery_columns` 1 or 2, `variant` `standard` or `three-column`, typed media
  items with allowed formats, and every media master present in
  `src/assets/`.

**The translation tracker never fails the build.** After the contract passes,
the build prints one line per Project listing the English fields whose Spanish
value is written but whose English value is not:

```text
Untranslated English values (12 projects):
  - src/proyectos/corteza-liquida.md: en.venue, en.dates
  …
```

It is printed with `logger.forceLog`, so it survives the quiet build `npm test`
runs; a fully translated corpus prints nothing. It does not cover `alt_en` (an
image's alt falls back to the project title) and does not cover a Spanish field
the project does not write. It is the only translation-status view: Pages CMS
renders one column per declared field and has no secondary line, so the list
cannot live in the app.

**How the two language trees are built.** `src/_data/languages.json` declares
each language's route prefix (`""`, `/en`), HTML code, Open Graph locale and
self-name. Every template that has two versions paginates over that list and
builds its permalink from the prefix — `index.njk`, `proyectos.njk` and
`acerca-de.md` in their own front matter, every project file through
`src/proyectos/proyectos.11tydata.json` — so one source file yields
`/proyectos/<slug>/` and `/en/proyectos/<slug>/`, and adding a new page or
project needs no per-language setting.

**Where the alternates come from.** A page's language is read from its route; a
*route* is the URL without the language prefix (`lib/languages.js`). The
`languageRoutes` collection is built from the pages Eleventy actually produced,
so it maps each route to the language versions that exist. The layouts, the
sitemap and the header's language link all read it: a route built in both
languages gets `hreflang` for `es`, `en` and `x-default` (the Spanish URL),
`og:locale:alternate`, the language link and the sitemap alternates in the same
build; a route built in one language alone gets none of them. There is no list
of translated routes to maintain.

## After handoff

- Editors publish straight to `main`: a save is a commit, and a commit on `main`
  deploys. There is no review step and no preview — Git history is the recovery
  path.
- A rename or delete changes or removes **two** public URLs: `/proyectos/<slug>/`
  and `/en/proyectos/<slug>/`. Pages CMS has no built-in URL-change warning and
  there are no redirects; the warning lives in the collection and Spanish title
  descriptions only.
- Translation proceeds one project at a time: an editor writes the English block
  when the text exists, copies a value when it is the same in both languages,
  and leaves the field out otherwise. Nothing about a missing translation blocks
  a deploy, and nothing on the page announces it.
- The chrome (site settings) has **no silent fallback**: a page reads
  `site[<its language>]` directly, so a blank English value renders blank. The
  404 copy is the exception that must be written in both languages, because the
  single `404.html` shows one line from each.
- Exposing every site setting includes keys no template reads. Their helper text
  says so; do not "fix" that by hiding them — a hidden key would be dropped on
  save.
- The three-column layout stays with Infernal Natures. A new project needing it
  requires a developer to set the hidden `variant: three-column`.
- Adding a third language means an entry in `src/_data/languages.json`, its
  chrome in `site.json`, its fields in `.pages.yml`, and its rules in the content
  contract, which names `es` and `en`. The routing, the hreflang set and the
  sitemap follow from the registry; it is not an editorial change.
