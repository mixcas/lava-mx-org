import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { REPO_ROOT, readRepoFile } from "./support/site.mjs";

/**
 * The handoff documentation, treated as part of the delivered system: the
 * curator guide, the maintainer checklist, the glossary and the ADR must exist,
 * stay linked from the README, and describe the shipped content model — not the
 * front matter the migration replaced.
 */

const EDITOR_GUIDE = "docs/editor-guide.md";
const MAINTAINER_CHECKLIST = "docs/maintainer-checklist.md";
const GLOSSARY = "GLOSSARY.md";
const ADR = "docs/adr/0001-pages-cms.md";

/** Read a committed document, failing with its path. */
function readDoc(relative) {
  const file = path.join(REPO_ROOT, relative);
  assert.ok(fs.existsSync(file), `${relative}: missing from the repository`);
  return readRepoFile(relative);
}

/** The README, the curator guide and the maintainer checklist. */
const currentDocs = () => [readRepoFile("README.md"), readDoc(EDITOR_GUIDE), readDoc(MAINTAINER_CHECKLIST)];

describe("editor guide (docs/editor-guide.md)", () => {
  const guide = readDoc(EDITOR_GUIDE);

  it("covers sign-in through the email invitation", () => {
    assert.match(guide, /invitaci[oó]n llega por correo/i, "editor guide: sign-in through an email invitation");
    assert.match(guide, /app\.pagescms\.org/, "editor guide: the app the editors open");
    assert.match(guide, /no necesitas cuenta de GitHub/i, "editor guide: no GitHub account required");
    assert.match(guide, /rama/i, "editor guide: choosing the branch to work on");
  });

  it("walks through projects, galleries, bilingual text, About and site settings", () => {
    for (const section of [
      /Encontrar un proyecto/i,
      /Editar los datos de un proyecto/i,
      /Editar la galer[ií]a/i,
      /texto en español y en inglés/i,
      /«Acerca de»/i,
      /Ajustes del sitio/i,
    ]) {
      assert.match(guide, section, `editor guide: missing section ${section}`);
    }

    for (const field of [
      /Título/,
      /Sede/,
      /Fechas/,
      /Proyecto en portada/,
      /Orden/,
      /Columnas de la galer[ií]a/,
      /Texto en español/,
      /Texto en inglés/,
      /Texto alternativo/,
      /Imagen de portada/,
      /Reproducción automática/,
      /Biografía en español/,
      /Biografía en inglés/,
      /Equipo/,
    ]) {
      assert.match(guide, field, `editor guide: field ${field} not explained`);
    }

    for (const action of [/elimina/i, /arrastra/i, /subir/i, /biblioteca/i]) {
      assert.match(guide, action, `editor guide: gallery action ${action} not explained`);
    }
  });

  it("explains publishing, the deploy wait and checking the live site", () => {
    assert.match(guide, /GitHub Actions/, "editor guide: the deploy workflow");
    assert.match(guide, /4 minutos/, "editor guide: the deploy takes about four minutes");
    assert.match(guide, /sitio publicado/i, "editor guide: checking the live site after the deploy");
    assert.match(guide, /rama de producción/, "editor guide: saves only publish from `main`");
  });

  it("states there is no rendered preview and warns about the filename URL", () => {
    assert.match(guide, /No hay vista previa/i, "editor guide: no rendered preview in the CMS");
    assert.match(guide, /cambia la dirección/i, "editor guide: filename/URL warning");
    assert.match(guide, /\/proyectos\/[a-z-]+\//, "editor guide: shows the URL a project filename produces");
  });
});

describe("maintainer checklist (docs/maintainer-checklist.md)", () => {
  const checklist = readDoc(MAINTAINER_CHECKLIST);

  it("covers installing the GitHub App and inviting editors as manual steps", () => {
    assert.match(checklist, /GitHub App/, "maintainer checklist: installing the Pages CMS GitHub App");
    assert.match(checklist, /mixcas\/lava-mx-org/, "maintainer checklist: names the repository to install on");
    assert.match(checklist, /invit/i, "maintainer checklist: inviting editors by email");
    assert.ok(
      (checklist.match(/\(manual\)/gi) ?? []).length >= 3,
      "maintainer checklist: installation, invitations, verification and the merge are marked manual",
    );
  });

  it("lists the branch verification steps earlier tickets required", () => {
    for (const step of [
      /non-production branch/i,
      /existing image/i,
      /upload a new image/i,
      /add a video/i,
      /reorder/i,
      /remove one item/i,
      /alt text/i,
      /poster/i,
      /autoplay/i,
      /SVG|TIFF|MOV/,
      /bio_es/,
      /site settings/i,
      /create a test project/i,
      /rename/i,
      /delete/i,
      /variant/i,
      /merge mode/i,
      /commits land on the branch/i,
    ]) {
      assert.match(checklist, step, `maintainer checklist: missing verification step ${step}`);
    }
  });

  it("ends with the production merge and the deploy check", () => {
    assert.match(checklist, /merge/i, "maintainer checklist: merging to production");
    assert.match(checklist, /Deploy to GitHub Pages/, "maintainer checklist: the production deploy workflow");
    assert.match(checklist, /four minutes/i, "maintainer checklist: the deploy wait");
    assert.match(checklist, /npm test/, "maintainer checklist: the suite to run before merging");
  });
});

describe("documentation links (README.md)", () => {
  const readme = readRepoFile("README.md");

  it("links the handoff docs, the glossary and the ADR", () => {
    for (const doc of [EDITOR_GUIDE, MAINTAINER_CHECKLIST, GLOSSARY, ADR, "MIGRATION-PLAN.md"]) {
      assert.ok(readme.includes(doc), `README.md: does not link ${doc}`);
    }
  });

  it("documents the test command and the subpath run", () => {
    assert.match(readme, /npm test/, "README.md: the test command");
    assert.match(readme, /PATH_PREFIX=.*npm test/, "README.md: running the suite for a subpath deployment");
  });
});

describe("domain glossary and Pages CMS ADR", () => {
  it("keeps the glossary vocabulary the docs use", () => {
    const glossary = readDoc(GLOSSARY);
    for (const term of [
      "Project",
      "Homepage project",
      "Archive project",
      "Gallery",
      "Media item",
      "Media source",
      "About page",
      "Site settings",
      "Editor",
      "Maintainer",
    ]) {
      assert.match(glossary, new RegExp(`\\*\\*${term}\\*\\*:`), `GLOSSARY.md: term "${term}" is not defined`);
    }
  });

  it("records the decision, its trade-offs and the shipped behaviour", () => {
    const adr = readDoc(ADR);
    for (const fact of [
      /Pages CMS/,
      /app\.pagescms\.org/,
      /Eleventy/,
      /branch/i,
      /no rendered page preview/i,
      /Git history is the recovery path/i,
      /project-contract/,
    ]) {
      assert.match(adr, fact, `ADR: does not record ${fact}`);
    }
  });
});

describe("content-model documentation", () => {
  it("no longer presents the removed fields as current", () => {
    // The pre-CMS shapes the build now rejects. MIGRATION-PLAN.md may mention
    // them only as history (checked separately below).
    const removed = [/media_left/, /media_middle/, /video:\s*true/, /muted/, /current:\s*true/];

    for (const [index, doc] of currentDocs().entries()) {
      for (const pattern of removed) {
        assert.doesNotMatch(doc, pattern, `current docs[${index}]: still describes the removed shape ${pattern}`);
      }
    }
  });

  it("marks the Cargo migration plan as historical and points at the current model", () => {
    const plan = readRepoFile("MIGRATION-PLAN.md");

    assert.match(plan, /\*\*Historical document\.\*\*/, "MIGRATION-PLAN.md: not marked as historical");
    assert.ok(plan.includes("README.md#content-model"), "MIGRATION-PLAN.md: does not point at the current content model");
    assert.ok(plan.includes(EDITOR_GUIDE), "MIGRATION-PLAN.md: does not point at the editor guide");
  });
});
