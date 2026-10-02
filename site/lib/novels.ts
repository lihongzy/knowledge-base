import { promises as fs } from "node:fs";
import path from "node:path";

// 小说源数据位于仓库根目录的 `小说/`（与 site/ 同级），
// 每个子文件夹是一部小说，内含 novel.json 与 chapters/ 正文目录。
const novelsDirectory = path.resolve(process.cwd(), "..", "小说");

export type NovelChapter = {
  seq: number;
  slug: string;
  title: string;
  file: string;
  url: string;
};

export type NovelVolume = {
  title: string;
  chapters: NovelChapter[];
};

export type NovelMeta = {
  id: string;
  slug: string;
  title: string;
  sourceCatalog?: string;
  volumes: NovelVolume[];
};

// 展平后带所属卷信息的章节（用于阅读页导航）
export type FlatChapter = NovelChapter & { volumeTitle: string };

// 阅读页需要的完整数据：正文 + 定位 + 上下章
export type ChapterReading = {
  novel: NovelMeta;
  chapter: FlatChapter;
  content: string;
  // 供 MarkdownContent 解析相对图片路径，指向 novel-assets
  relativePath: string;
  prev?: FlatChapter;
  next?: FlatChapter;
};

async function readNovelMeta(novelId: string): Promise<NovelMeta | undefined> {
  try {
    const raw = await fs.readFile(path.join(novelsDirectory, novelId, "novel.json"), "utf8");
    const parsed = JSON.parse(raw) as Partial<NovelMeta>;
    const volumes = (parsed.volumes ?? []).map((volume) => ({
      title: volume.title,
      chapters: (volume.chapters ?? []).map((chapter) => ({
        ...chapter,
        // 兼容旧清单：缺 slug 时回退到去 .md 的文件名
        slug: chapter.slug || chapter.file.replace(/\.md$/i, ""),
      })),
    }));
    return {
      id: novelId,
      slug: parsed.slug || novelId,
      title: parsed.title || novelId,
      sourceCatalog: parsed.sourceCatalog,
      volumes,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

// 列出全部小说（读取每个子目录的 novel.json 元信息，不加载正文）
export async function getNovels(): Promise<NovelMeta[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(novelsDirectory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const novels = await Promise.all(entries.map((name) => readNovelMeta(name)));
  return novels.filter((novel): novel is NovelMeta => Boolean(novel));
}

// 按 URL slug 查找小说（slug 为 ASCII；也兼容用文件夹 id 访问）
export async function getNovel(novelSlug: string): Promise<NovelMeta | undefined> {
  const wanted = decodeURIComponent(novelSlug);
  const novels = await getNovels();
  return novels.find((novel) => novel.slug === wanted || novel.id === wanted);
}

// 将某部小说的章节按全局顺序展平，并附带所属卷标题
export function flattenChapters(novel: NovelMeta): FlatChapter[] {
  const flat: FlatChapter[] = [];
  for (const volume of novel.volumes) {
    for (const chapter of volume.chapters) {
      flat.push({ ...chapter, volumeTitle: volume.title });
    }
  }
  // 以 seq 为准排序，确保上一章/下一章导航正确
  return flat.sort((a, b) => a.seq - b.seq);
}

// 读取某章正文，并计算上下章，用于阅读页（chapter 为章节 ASCII slug）
export async function getChapterReading(
  novelSlug: string,
  chapterParam: string,
): Promise<ChapterReading | undefined> {
  const novel = await getNovel(novelSlug);
  if (!novel) return undefined;

  const wanted = decodeURIComponent(chapterParam);
  const chapters = flattenChapters(novel);
  const index = chapters.findIndex((chapter) => chapter.slug === wanted);
  if (index === -1) return undefined;
  const target = chapters[index];

  let content: string;
  try {
    content = await fs.readFile(
      path.join(novelsDirectory, novel.id, "chapters", target.file),
      "utf8",
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }

  return {
    novel,
    chapter: target,
    content,
    relativePath: `${novel.id}/chapters/${target.file}`,
    prev: chapters[index - 1],
    next: chapters[index + 1],
  };
}

export function novelChapterCount(novel: NovelMeta): number {
  return novel.volumes.reduce((total, volume) => total + volume.chapters.length, 0);
}
