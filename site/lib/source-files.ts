import { promises as fs } from "node:fs";
import path from "node:path";

const notesDirectory = path.resolve(process.cwd(), "..", "notes");
const ignoredDirectories = new Set([".venv", "node_modules", "__pycache__", ".git"]);
const sourceExtensions = new Set([".py", ".js", ".jsx", ".ts", ".tsx", ".json", ".sh", ".ps1"]);

export type SourceFile = {
  content: string;
  relativePath: string;
  slug: string[];
};

export function isSourceFile(relativePath: string): boolean {
  const segments = relativePath.split("/");
  return segments.includes("code") && sourceExtensions.has(path.posix.extname(relativePath).toLowerCase());
}

async function collectSourceFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    if (ignoredDirectories.has(entry.name)) return [];
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(entryPath);
    if (!entry.isFile()) return [];
    const relativePath = path.relative(notesDirectory, entryPath).split(path.sep).join("/");
    return isSourceFile(relativePath) ? [entryPath] : [];
  }));
  return files.flat();
}

export async function getAllSourceFiles(): Promise<SourceFile[]> {
  const files = await collectSourceFiles(notesDirectory);
  return Promise.all(files.map(async (filePath) => {
    const relativePath = path.relative(notesDirectory, filePath).split(path.sep).join("/");
    return {
      content: await fs.readFile(filePath, "utf8"),
      relativePath,
      slug: relativePath.split("/"),
    };
  }));
}

export async function getSourceFile(slug: string[]): Promise<SourceFile | undefined> {
  const relativePath = slug.map(decodeURIComponent).join("/");
  return (await getAllSourceFiles()).find((file) => file.relativePath === relativePath);
}
