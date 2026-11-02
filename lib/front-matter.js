/**
 * YAML front matter of a Markdown file.
 *
 * The build (`lib/project-contract.js`) and the suite's content assertions read
 * the same project files, so they parse them with this one helper and report
 * the same problems.
 */

import yaml from "js-yaml";

/**
 * Parse a Markdown file's YAML front matter.
 *
 * @param {string} source the whole file
 * @returns {{ data: object } | { error: string }} the parsed keys, or a message
 *   describing why the file has none
 */
export function parseFrontMatter(source) {
  const text = String(source ?? "");
  const body = text.replace(/^---[ \t]*\r?\n/, "");
  const end = body.search(/^---[ \t]*\r?$/m);
  if (body === text || end === -1) {
    return { error: "the file has no YAML front matter" };
  }
  try {
    return { data: yaml.load(body.slice(0, end)) ?? {} };
  } catch (error) {
    return { error: `the front matter is not valid YAML (${error.message.split("\n")[0]})` };
  }
}
