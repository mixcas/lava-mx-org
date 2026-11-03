# Pages CMS — maintainer checklist

How to turn on editing for the curators and check it before editors rely on it.
The curators themselves read [`docs/editor-guide.md`](editor-guide.md); this file
is the maintainer half: app installation, invitations, branch verification and
the production merge.

The CMS is configured by `.pages.yml` at the repository root and read per
repository **and per branch**. Nothing here is installed in the repository: the
app, the GitHub App installation and the collaborator records live in Pages CMS.
The configuration itself is committed and reviewable like any other file.

Steps marked **(manual)** cannot be done from this repository — they need a
signed-in GitHub session in the hosted app.

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
   collections, field labels and helper text in Spanish, the project list showing
   title, homepage status, order and dates.
3. **Project form**
   - Open a project: title, venue, dates, both texts, homepage status, order,
     gallery columns and the gallery all render.
   - Confirm the filename input is visible — pre-filled from the title when
     creating, locked until unlocked when editing.
   - Confirm the URL warning is visible: the collection description and the
     `Título` field helper text both say the filename is the public URL. If the
     app does not render the collection description, move that warning into the
     field descriptions and update the editor guide.
   - Confirm `variant` is nowhere in the form (three-column stays
     developer-only).
4. **Gallery editor**
   - Add an existing image from the media library.
   - Upload a new image.
   - Add a video, choose a poster, and toggle autoplay / loop / mute.
   - Set the alt text on the image items (leave one empty to see the title
     fallback on the deployed page).
   - Drag items to reorder and remove one item.
   - Save and confirm the committed front matter keeps canonical paths
     (`/assets/images/…`, `/assets/videos/…`), the original filenames and the
     item order.
   - Set **Columnas de la galería** to 1 and to 2 and confirm a number is saved.
5. **Upload restrictions** — try an unsupported format (SVG or TIFF for images,
   MOV for video) and confirm the media source rejects it. This is deliberate:
   only WebP, JPG, JPEG, PNG, AVIF and GIF images, MP4 and WebM videos and PDF
   documents are publishable.
6. **Bilingual text and About** — edit `text_es` and `text_en`, save, and confirm
   both live in front matter (not in the Markdown body). Do the same for
   `bio_es`, `bio_en` and `team`; confirm `title` and `layout` are not editable
   and survive the save. Upload a PDF from the insert button in `text_es` and
   confirm the link points at `/assets/files/…` and the file lands in
   `src/assets/files/`.
7. **Site settings** — change one value that reaches the site (for example the
   footer city) and one that does not (for example *Dirección del sitio*), save,
   and confirm both survive and the description says which one has no effect.
8. **Create, rename, delete** — create a test project (the filename is seeded
   from the title), rename it, then delete it.
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
3. Open the live site in a private window:
   - the homepage shows the selected homepage projects in order;
   - `/proyectos/` shows every other project in order;
   - a project page shows title, venue, dates, Spanish text and, when it exists,
     English text after the `//` divider;
   - gallery images render responsively and videos play with their poster and
     flags;
   - a dossier link still resolves, including under a subpath deployment.
4. Confirm the behavior in the app once more against `main` (the configuration is
   read per branch, so a branch-only edit is not in effect on production).

## After handoff

- Editors publish straight to `main`: a save is a commit, and a commit on `main`
  deploys. There is no review step and no preview — Git history is the recovery
  path.
- A rename or delete changes or removes a public URL. Pages CMS has no built-in
  URL-change warning and there are no redirects; the warning lives in the
  collection and title descriptions only.
- Exposing every site setting includes keys no template reads. Their helper text
  says so; do not "fix" that by hiding them — a hidden key would be dropped on
  save.
- The three-column layout stays with Infernal Natures. A new project needing it
  requires a developer to set the hidden `variant: three-column`.
