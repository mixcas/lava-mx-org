import fs from "node:fs";
import path from "node:path";

import { parseFrontMatter } from "../../lib/front-matter.js";
import { readRepoFile, REPO_ROOT } from "./site.mjs";

/**
 * The front matter of a committed Markdown file, parsed by the same helper the
 * build uses, so a content-contract assertion and the build read a file alike.
 */
export function projectData(relativePath) {
  const parsed = parseFrontMatter(readRepoFile(relativePath));
  if (parsed.error) throw new Error(`${relativePath}: ${parsed.error}`);
  return parsed.data;
}

/** Project content files under `src/proyectos/`, relative to the repo root. */
export function projectFiles() {
  return fs
    .readdirSync(path.join(REPO_ROOT, "src/proyectos"))
    .filter((entry) => entry.endsWith(".md"))
    .sort()
    .map((entry) => `src/proyectos/${entry}`);
}

/** Project route for a project content file (the filename is the URL). */
export function projectRoute(file) {
  return `/proyectos/${path.basename(file, ".md")}/`;
}
