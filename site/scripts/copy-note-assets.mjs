import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const siteDirectory = path.resolve(scriptDirectory, "..");
const notesDirectory = path.resolve(siteDirectory, "..", "notes");
const destination = path.join(siteDirectory, "public", "note-assets");

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

await cp(notesDirectory, destination, {
  recursive: true,
  filter: (source) => !source.toLowerCase().endsWith(".md"),
});
