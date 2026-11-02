import fs from "node:fs";
import path from "node:path";

import { readRepoFile, REPO_ROOT } from "./site.mjs";

/**
 * The top-level keys of a Markdown file's YAML front matter, as raw scalar text.
 *
 * Content-contract assertions only need to know which keys a project file
 * carries (so a removed legacy key cannot creep back) and a few scalar values,
 * so this reads the key/value lines at column zero instead of parsing YAML.
 */
export function frontMatter(relativePath) {
  const source = readRepoFile(relativePath).replace(/^---\r?\n/, "");
  const end = source.search(/^---\r?$/m);
  if (end === -1) throw new Error(`${relativePath}: no closing front matter delimiter`);

  const keys = {};
  for (const line of source.slice(0, end).split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) keys[match[1]] = match[2].trim();
  }
  return keys;
}

/** Project content files under `src/proyectos/`, relative to the repo root. */
export function projectFiles() {
  return fs
    .readdirSync(path.join(REPO_ROOT, "src/proyectos"))
    .filter((entry) => entry.endsWith(".md"))
    .sort()
    .map((entry) => `src/proyectos/${entry}`);
}
