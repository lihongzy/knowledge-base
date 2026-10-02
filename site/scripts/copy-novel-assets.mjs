import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const siteDirectory = path.resolve(scriptDirectory, "..");
const novelsDirectory = path.resolve(siteDirectory, "..", "小说");
const destination = path.join(siteDirectory, "public", "novel-assets");
const ignoredDirectories = new Set([".venv", "node_modules", "__pycache__", ".git"]);

// 先清空再拷贝，保证与源目录一致（只拷正文目录下的非 .md 资源，如图片）
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

try {
  await cp(novelsDirectory, destination, {
    recursive: true,
    errorOnExist: false,
    force: true,
    filter: (source) => {
      const relativePath = path.relative(novelsDirectory, source);
      const segments = relativePath.split(path.sep);
      const fileName = path.basename(source).toLowerCase();
      // 只保留 chapters 目录下的资源文件：排除 .md、清单、隐藏/依赖目录
      return (
        !fileName.endsWith(".md") &&
        fileName !== "novel.json" &&
        fileName !== "scratch.js" &&
        fileName !== "package.json" &&
        fileName !== "package-lock.json" &&
        !segments.some((segment) => ignoredDirectories.has(segment))
      );
    },
  });
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

console.log("已同步小说资源到 site/public/novel-assets");
