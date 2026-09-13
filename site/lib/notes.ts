import { promises as fs } from "node:fs";
import path from "node:path";

export const categoryNames: Record<string, string> = {
  "00-inbox": "收件箱",
  "10-projects": "项目",
  "20-areas": "领域",
  "30-resources": "资源",
  "40-archive": "归档",
};

export type Note = {
  content: string;
  relativePath: string;
  slug: string[];
  title: string;
};

const notesDirectory = path.resolve(process.cwd(), "..", "notes");
const ignoredDirectories = new Set([".venv", "node_modules", "__pycache__", ".git"]);

async function collectMarkdownFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return ignoredDirectories.has(entry.name) ? [] : collectMarkdownFiles(entryPath);
      return entry.isFile() && entry.name.toLowerCase().endsWith(".md") ? [entryPath] : [];
    }),
  );
  return files.flat();
}

function titleFrom(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1].trim() || fallback;
}

export async function getAllNotes(): Promise<Note[]> {
  const files = await collectMarkdownFiles(notesDirectory);
  return Promise.all(
    files.map(async (filePath) => {
      const content = await fs.readFile(filePath, "utf8");
      const relativePath = path.relative(notesDirectory, filePath).split(path.sep).join("/");
      const fileWithoutExtension = relativePath.replace(/\.md$/i, "");
      return {
        content,
        relativePath,
        slug: fileWithoutExtension.split("/"),
        title: titleFrom(content, path.basename(fileWithoutExtension)),
      };
    }),
  );
}

export async function getNote(slug: string[]): Promise<Note | undefined> {
  const fileWithoutExtension = slug.map(decodeURIComponent).join("/");
  const relativePath = `${fileWithoutExtension}.md`;
  try {
    const content = await fs.readFile(path.join(notesDirectory, relativePath), "utf8");
    return {
      content,
      relativePath,
      slug: fileWithoutExtension.split("/"),
      title: titleFrom(content, path.basename(fileWithoutExtension)),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export function categoryFor(note: Note): string {
  return note.relativePath.split("/")[0];
}

export function categoryLabel(category: string): string {
  return categoryNames[category] ?? category;
}
