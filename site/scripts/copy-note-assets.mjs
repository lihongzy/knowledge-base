import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const siteDirectory = path.resolve(scriptDirectory, "..");
const notesDirectory = path.resolve(siteDirectory, "..", "notes");
const destination = path.join(siteDirectory, "public", "note-assets");
const ignoredDirectories = new Set([".venv", "node_modules", "__pycache__", ".git"]);

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

await cp(notesDirectory, destination, {
  recursive: true,
  filter: (source) => {
    const relativePath = path.relative(notesDirectory, source);
    const segments = relativePath.split(path.sep);
    const fileName = path.basename(source).toLowerCase();
    return !source.toLowerCase().endsWith(".md")
      && !segments.some((segment) => ignoredDirectories.has(segment))
      && fileName !== ".env"
      && fileName !== ".env.example";
  },
});
