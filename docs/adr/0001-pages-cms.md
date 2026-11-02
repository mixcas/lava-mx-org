# Use Pages CMS as the Git-based editing layer

## Status

Accepted

## Context

The site is an Eleventy v3 site deployed to GitHub Pages from a public GitHub repository. The content is Markdown and front matter in Git. The editors are non-technical and should not need GitHub accounts.

## Decision

Use Pages CMS hosted at `app.pagescms.org` as the editing layer. Keep Eleventy and GitHub Pages. Configure the project collection, About page, and site settings in `.pages.yml`.

## Considered Options

- **Sveltia CMS**: better editing UX and page previews, but requires GitHub accounts and OAuth setup.
- **CloudCannon**: strong visual editing, but commercial.
- **Database CMS**: overkill for a 12-project static site.

## Consequences

- Editors are invited by email; no GitHub account or OAuth worker is required.
- Each save commits to `main` and triggers the existing deploy.
- There is no rendered page preview inside the CMS.
- Pages CMS is a hosted third-party app. It is MIT-licensed and can be self-hosted if needed.
