# Use Pages CMS as the Git-based editing layer

## Status

Accepted — 2026-11-02

## Context

The site is an Eleventy v3 site deployed to GitHub Pages from a public GitHub
repository. The content is Markdown and front matter in Git. The editors are
non-technical curators; they should not need GitHub accounts, and a mistake in
raw front matter should not be able to silently drop a gallery, change a project
URL, or break a dossier link.

Before exposing an editing layer, the content model was normalized: one typed
gallery per project, `text_es` / `text_en` instead of one text with a literal `//`
separator, `bio_es` / `bio_en` on the About page, `featured` instead of `current`,
directory-level defaults instead of per-file `layout` / `slug`, canonical asset
paths for media, and a build-time content contract.

## Decision

Use Pages CMS hosted at `app.pagescms.org` as the editing layer. Keep Eleventy and
GitHub Pages. Configure the project collection, the About page and the site
settings in `.pages.yml` at the repository root, committed to Git and read per
repository **and per branch**.

The shipped configuration:

- labels and helper text in Spanish (the app chrome stays English);
- `settings.content.merge: true`, so keys outside the schema (`variant`) survive
  a save;
- `settings.commit.identity: user`, so each save is committed as the editor who
  made it (the push still uses the GitHub App installation token);
- three media sources — images, videos and documents — that keep original
  filenames and reject formats the build cannot publish (WebP, JPG, JPEG, PNG,
  AVIF, GIF; MP4, WebM; PDF);
- rich-text fields that insert from the documents library, so an editor can
  upload a PDF while writing and link to it;
- a gallery modelled as a block list keyed by `type` (`image` / `video`), with
  alt text, an optional video poster and autoplay / loop / mute flags;
- create, rename and delete enabled for projects, with the filename visible on
  create and on edit.

## Considered Options

- **Sveltia CMS**: better editing UX and page previews, but requires GitHub
  accounts and OAuth setup.
- **CloudCannon**: strong visual editing, but commercial.
- **Database CMS**: overkill for a 12-project static site.

## Consequences

- Editors are invited by email; no GitHub account or OAuth worker is required.
  Invitations and the GitHub App installation are manual maintainer actions.
- A save is a commit on the branch selected in the app. Only `main` deploys
  (the deploy workflow runs on pushes to `main` and on manual dispatch), so a
  branch can be verified before it is merged.
- Collaborator writes push with the GitHub App installation token; commits are
  authored by the editor who saved (`settings.commit.identity: user`), not by
  the app.
- There is no rendered page preview inside the CMS. Editors check the live site
  after the deploy, currently about four minutes.
- There is no URL-change warning in the app and no redirects. The warning lives
  in the project collection and `title` field descriptions, and changing a
  filename changes the public URL; Git history is the recovery path.
- Invalid content is caught by the build (`lib/project-contract.js`), which fails
  with the project file and field named instead of publishing a broken page.
- Pages CMS is a hosted third-party app. It is MIT-licensed and can be self-hosted
  if needed.
- The curator workflow is recorded in `docs/editor-guide.md`; the maintainer
  setup in `docs/maintainer-checklist.md`.
