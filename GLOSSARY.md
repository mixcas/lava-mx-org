# Lava

Static bilingual site for Lava, a curatorial collective in Mexico City.

## Language

**Language version**:
The Spanish or English rendering of a page. Every page has both; Spanish is the default.
_Avoid_: Translation, locale, copy

**Language link**:
The single link in the header to the same route in the other language. It names
that language in that language — «English», «Español» — and only appears when the
counterpart page was built. It is a plain anchor: no script, no cookie, no
automatic detection.
_Avoid_: Language switcher, locale selector, language menu

**Untranslated field**:
A field with no English value written, so the English language version shows the Spanish value instead, without a notice.
_Avoid_: Missing translation, empty field

**Translation tracker**:
The list the build prints of the projects and English fields still untranslated. It reports and never fails the build; it is the only translation-status view, since Pages CMS cannot show one.
_Avoid_: Translation status, progress report, missing-string list

**Neutral value**:
An English value written to be identical to its Spanish value because the text is not Spanish-specific — a project name, a venue.
_Avoid_: Same translation, duplicated field

**Project**:
An exhibition, open studio, or other curatorial presentation represented by one Markdown entry under `src/proyectos/`; that entry carries both language versions.
_Avoid_: Show, event, entry

**Homepage project**:
A project selected by an editor to appear on the homepage, independent of its exhibition dates.
_Avoid_: Current project, active project, featured project, ongoing project
_Front matter_: `featured: true`; the `featuredProjects` collection.
_Public label_: the homepage heading reads «proyectos actuales» (the site copy for this group, not a second term).

**Archive project**:
A project that is not selected for the homepage; it appears on the project archive page.
_Avoid_: Past project, other project
_Front matter_: `featured` absent or `false`; the `archiveProjects` collection.

**Gallery**:
The ordered set of media items shown with a project.
_Avoid_: Carousel, slideshow

**Media item**:
An image or video in a project's gallery, ordered by the editor.
_Avoid_: Asset, attachment, file

**Media source**:
One of the three libraries Pages CMS uploads into and writes canonical paths
from: images (`src/assets/images` → `/assets/images`), videos
(`src/assets/videos` → `/assets/videos`) and documents (`src/assets/files` →
`/assets/files`).
_Avoid_: Folder, bucket, upload type

**About page**:
The collective's identity page, one file at `src/acerca-de.md`, holding a
biography and a team list in each language.
_Avoid_: Bio page, info page

**Site settings**:
The single data file `src/_data/site.json` shared by every page: the
language-neutral data (site name, contact details, social links), and, per
language version, the description, footer text and navigation labels, plus the
navigation routes that links are built from.
_Avoid_: Config, globals

**Editor**:
A curator invited by email to Pages CMS who edits projects, the About page and
the site settings, and whose saves become commits.
_Avoid_: User, author
_Pages CMS_: collaborator

**Maintainer**:
A person with GitHub access to the repository: owns `.pages.yml`, the Pages CMS
GitHub App installation, the invitations and the deploy.
_Avoid_: Admin, developer
