import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Build-time payload: <script id="projects" type="application/json"> is injected from data/projects.json.
// Runtime stays static: pages/index.html opens over file:// with zero fetch.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = resolve(root, "data/projects.json");
const templatePath = resolve(root, "templates/index.template.html");
const htmlPath = resolve(root, "pages/index.html");

const data = JSON.parse(readFileSync(dataPath, "utf8"));
const template = readFileSync(templatePath, "utf8");
const marker = "/*__PROJECTS_JSON__*/";
if (!template.includes(marker)) { throw new Error("template marker missing"); }
const json = JSON.stringify(data, null, 2).replace(/</g, "\u003c");
const html = template.replace(marker, json);
mkdirSync(dirname(htmlPath), { recursive: true });
writeFileSync(htmlPath, html, "utf8");
process.stdout.write("WROTE " + htmlPath + "\n");
process.stdout.write("PROJECTS " + data.projects.length + "\n");
process.stdout.write("SOURCE data/projects.json\n");
