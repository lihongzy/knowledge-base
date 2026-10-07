import { promises as fs } from "node:fs";
import path from "node:path";

// notes 之外、但被笔记相对链接引用的 Markdown 文档（如各项目 README），
// 部署时静态纳入 /files 路由，在站内渲染。
const repoRoot = path.resolve(process.cwd(), "..");

// 发布为 /files 的 Markdown 内容根（相对仓库根）。notes 下的 .md 由 /notes 承载，不在此列。
export const docRoots = ["动漫", "小说"];

const ignoredDirectories = new Set([".venv", "node_modules", "__pycache__", ".git", ".next", "out", "dist"]);
// 这些目录下的 .md 不在 /files 重复渲染（小说章节已由 /novels 承载）。
const excludedDirectories = new Set(["chapters"]);

export type RepoDoc = {
  content: string;
  relativePath: string; // 仓库根相对 posix 路径，如 动漫/进击的巨人/README.md
  slug: string[];
  title: string;
};

function titleFrom(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1].trim() || fallback;
}

// 是否落在被发布的文档根之下，且不是越界路径。
export function isUnderDocRoot(relativePath: string): boolean {
  if (relativePath.startsWith("..") || path.posix.isAbsolute(relativePath)) return false;
  return docRoots.some((root) => relativePath === root || relativePath.startsWith(`${root}/`));
}

async function collectDocRelativePaths(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const nested = await Promise.all(
    entries.map(async (entry) => {
      if (ignoredDirectories.has(entry.name) || excludedDirectories.has(entry.name)) return [];
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectDocRelativePaths(entryPath);
      if (!entry.isFile()) return [];
      if (!entry.name.toLowerCase().endsWith(".md")) return [];
      return [path.relative(repoRoot, entryPath).split(path.sep).join("/")];
    }),
  );
  return nested.flat();
}

export async function getAllRepoDocs(): Promise<RepoDoc[]> {
  const groups = await Promise.all(docRoots.map((root) => collectDocRelativePaths(path.join(repoRoot, root))));
  const relativePaths = groups.flat().sort();
  return Promise.all(
    relativePaths.map(async (relativePath) => {
      const content = await fs.readFile(path.join(repoRoot, relativePath), "utf8");
      return {
        content,
        relativePath,
        slug: relativePath.split("/"),
        title: titleFrom(content, path.basename(relativePath, ".md")),
      };
    }),
  );
}

export async function getRepoDoc(slug: string[]): Promise<RepoDoc | undefined> {
  const relativePath = slug.map(decodeURIComponent).join("/");
  if (!isUnderDocRoot(relativePath) || !relativePath.toLowerCase().endsWith(".md")) return undefined;
  try {
    const content = await fs.readFile(path.join(repoRoot, relativePath), "utf8");
    return {
      content,
      relativePath,
      slug: relativePath.split("/"),
      title: titleFrom(content, path.basename(relativePath, ".md")),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
