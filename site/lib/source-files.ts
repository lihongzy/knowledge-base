import { promises as fs } from "node:fs";
import path from "node:path";

// 仓库根：site/ 的上一级。构建期（SSG）直接读盘，把外部源码也纳入 /code，
// 这样笔记里指向 动漫/、小说/ 的相对链接在部署站点上也能打开。
export const repoRoot = path.resolve(process.cwd(), "..");

// 部署时静态纳入 /code 的内容根（相对仓库根）。
export const sourceRoots = ["notes", "动漫", "小说"];

const ignoredDirectories = new Set([".venv", "node_modules", "__pycache__", ".git", ".next", "out", "dist"]);
// 这些文件名虽是源码扩展名，但体积大且非笔记会引用的对象，排除以免生成无用的巨型页面。
const ignoredFileNames = new Set(["package-lock.json"]);
const sourceExtensions = new Set([".py", ".js", ".jsx", ".ts", ".tsx", ".json", ".sh", ".ps1"]);

export type SourceFile = {
  content: string;
  relativePath: string; // 仓库根相对 posix 路径，如 动漫/进击的巨人/downloadVideo.js
  slug: string[];
};

// 仅按扩展名判定是否为源码文件（不再要求在 code 目录内）。
export function isSourceFile(relativePath: string): boolean {
  // MPEG-TS 视频不是 TypeScript，不能生成源码页或搜索结果。
  if (/\/videos\/.*\.ts$/i.test(relativePath)) return false;
  return sourceExtensions.has(path.posix.extname(relativePath).toLowerCase());
}

// 是否落在被发布的内容根之下，且不是越界路径。
export function isUnderSourceRoot(relativePath: string): boolean {
  if (relativePath.startsWith("..") || path.posix.isAbsolute(relativePath)) return false;
  return sourceRoots.some((root) => relativePath === root || relativePath.startsWith(`${root}/`));
}

async function collectSourceRelativePaths(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const nested = await Promise.all(
    entries.map(async (entry) => {
      if (ignoredDirectories.has(entry.name)) return [];
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectSourceRelativePaths(entryPath);
      if (!entry.isFile()) return [];
      if (ignoredFileNames.has(entry.name.toLowerCase())) return [];
      const relativePath = path.relative(repoRoot, entryPath).split(path.sep).join("/");
      return isSourceFile(relativePath) ? [relativePath] : [];
    }),
  );
  return nested.flat();
}

export async function getAllSourcePaths(): Promise<string[]> {
  const groups = await Promise.all(sourceRoots.map((root) => collectSourceRelativePaths(path.join(repoRoot, root))));
  return groups.flat().sort();
}

export async function getAllSourceFiles(): Promise<SourceFile[]> {
  const relativePaths = await getAllSourcePaths();
  return Promise.all(
    relativePaths.map(async (relativePath) => ({
      content: await fs.readFile(path.join(repoRoot, relativePath), "utf8"),
      relativePath,
      slug: relativePath.split("/"),
    })),
  );
}

export async function getSourceFile(slug: string[]): Promise<SourceFile | undefined> {
  const relativePath = slug.map(decodeURIComponent).join("/");
  if (!isUnderSourceRoot(relativePath) || !isSourceFile(relativePath)) return undefined;
  try {
    return {
      content: await fs.readFile(path.join(repoRoot, relativePath), "utf8"),
      relativePath,
      slug: relativePath.split("/"),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
