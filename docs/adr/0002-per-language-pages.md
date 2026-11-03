# Serve one page per language, Spanish at the root

## Status

Accepted — 2026-11-02

## Context

The site is bilingual in intent but mixed in practice: the twelve projects and
the About page carry `text_es` and an optional `text_en`, both rendered on one
URL with a template-drawn `//` between them; `title`, `venue`, `dates`,
gallery alt text and the team list have no language dimension at all; the
header labels are single strings holding both languages ("Lava es — Lava is");
`<html lang="es">` is hardcoded; and no `hreflang` exists anywhere. Three of
twelve projects have English text.

Editors are non-technical curators (ADR-0001). The twelve project URLs and the
About URL are already public — linked from dossiers, printed matter and
Instagram — and GitHub Pages serves no server redirects.

## Decision

Give every page a Spanish language version at its current root URL and an
English language version under `/en/`, with the same path segments and the same
slug on both sides. Spanish stays the default and the canonical origin.

- One Markdown entry per project carries both language versions as two objects:
  `es: {title, venue, dates, text}` and `en: {title, venue, dates, text}`. The
  `en` object is optional, and its absence is what "untranslated" means. Each
  media item keeps one `alt_es` and one `alt_en`; the gallery, `featured`,
  `order`, `variant` and `gallery_columns` are shared by both versions.
- `es.title` names the file and therefore the slug of both versions; the English
  URL keeps the Spanish slug.
- Where an English value is absent, the English language version shows the
  Spanish value silently. The build prints the list of absent values and never
  fails on them.
- All chrome text moves into `src/_data/site.json` in `es` and `en` subtrees;
  navigation stores labels plus a route key, and link URLs are derived.
- Each page emits `hreflang` for `es`, `en` and `x-default` (the Spanish URL),
  `og:locale` / `og:locale:alternate`, a self-referencing canonical, and
  `xhtml:link` alternates in the sitemap.
- The header carries one link to the counterpart language; there is no
  auto-detection and no cookie.
- The stacked `es // en` presentation, the divider partial and its styling are
  retired. The single root `404.html` — the only page that cannot know which
  language version was wanted — carries a short line in each language.
- Two phases: first restructure the content into `es` / `en` objects and extend
  the content contract and view model with the output unchanged; then flip
  routing, chrome, metadata and the rendering tests.

## Considered Options

- **Symmetric `/es/` and `/en/`.** Cleaner prefix logic, but it moves Spanish
  off the root and breaks all fifteen existing public URLs, which GitHub Pages
  can only patch with per-path redirect stubs.
- **Translated segments** (`/es/proyectos/` + `/en/projects/`). Best for
  English SEO, but it needs a slug per language, and the CMS rule that the file
  name defines the URL could no longer define both.
- **One Markdown file per language version.** Each editor edits a whole English
  page as a unit, but the gallery (up to thirteen ordered media items) would be
  duplicated or need a third shared file, plus an invariant that both files keep
  it identical.
- **A visible notice, or hiding untranslated projects from the English archive.**
  A notice was rejected as noise; hiding nine of twelve projects was rejected
  because it argues against the collective's own archive.

## Consequences

- Every existing URL keeps working. English URLs contain Spanish segments
  (`/en/proyectos/`); this is deliberate, not an oversight.
- hreflang claims full coverage, and it is truthful — every English page exists
  and is indexable — but an untranslated English page is indexed as an English
  page containing Spanish prose. Fallback blocks still carry `lang="es"` so
  screen readers announce them as Spanish: silent to the eye, not to a reader.
- The translation tracker is the editorial workflow: an absent English value,
  or an entirely absent `en` object, means "to translate"; an English value
  equal to the Spanish means "neutral, looked at". Nothing renders differently.
- The content contract must accept an absent `en` object at every level; today
  it requires `text_es` and ignores `text_en` entirely. The Spanish object keeps
  today's rules (`es.title` and `es.text` required, `es.venue` and `es.dates`
  optional because one project has no venue), and a present English value must
  be non-empty, so a blank field can never claim to be translated. That
  non-blank rule lives only in the build: Pages CMS has no conditional,
  cross-field or rich-text validation.
- Every paired field doubles the size of the `.pages.yml` project and About
  schemas. Labels and helper text stay in Spanish (ADR-0001). Nesting the two
  languages in `object` fields is not cosmetic: it is the only way Pages CMS can
  present them as labelled, bordered blocks, since it has no tabs, sections or
  i18n of any kind.
- This supersedes the `text_es` / `text_en` naming in ADR-0001, but not its
  reasoning: the two values stay separate and the `//` separator is still never
  stored. The CMS deletes emptied fields on save, so clearing an English field
  and never having written one are the same state.
- The collection list cannot show which projects are translated: Pages CMS
  renders one column per declared field and has no secondary-line setting. The
  build's tracker is the only status view.
- Tests that assert one URL renders Spanish then English behind a `//` divider
  are replaced by tests that each route exists in both languages, that
  `<html lang>` matches the route, and that a Spanish page never contains
  English text.
- `.pages.yml`, `docs/editor-guide.md` and `README.md` all describe the stacked
  rendering and must change with the second phase.
