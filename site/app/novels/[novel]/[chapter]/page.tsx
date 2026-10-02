import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkdownContent } from "@/components/markdown-content";
import { NovelToc } from "@/components/novel-toc";
import { flattenChapters, getChapterReading, getNovels, novelChapterCount } from "@/lib/novels";
import { encodePath, pageHref } from "@/lib/site";

export const dynamicParams = false;

export async function generateStaticParams() {
  const novels = await getNovels();
  return novels.flatMap((novel) =>
    flattenChapters(novel).map((chapter) => ({
      novel: novel.slug,
      chapter: chapter.slug,
    })),
  );
}

export default async function NovelChapterPage({
  params,
}: {
  params: Promise<{ novel: string; chapter: string }>;
}) {
  const { novel: novelId, chapter: chapterParam } = await params;
  const reading = await getChapterReading(novelId, chapterParam);
  if (!reading) notFound();

  const { novel, chapter, prev, next } = reading;
  const chapterHref = (item: typeof chapter) =>
    pageHref(`/novels/${encodePath(novel.slug)}/${encodePath(item.slug)}/`);

  return (
    <div className="mx-auto w-[min(1200px,calc(100%_-_48px))] pt-[46px] pb-[100px] max-sm:pt-[32px]">
      <nav className="mb-[36px] flex flex-wrap gap-[9px] font-mono text-xs text-ink-muted max-sm:mb-[24px]" aria-label="面包屑">
        <Link className="hover:text-pine" href={pageHref("/")}>知识库</Link>
        <span>/</span>
        <Link className="hover:text-pine" href={pageHref("/novels/")}>小说</Link>
        <span>/</span>
        <Link className="hover:text-pine" href={pageHref(`/novels/${encodePath(novel.slug)}/`)}>{novel.title}</Link>
      </nav>

      <div className="grid grid-cols-1 items-start gap-[44px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <NovelToc
          novel={novel}
          currentSlug={chapter.slug}
          totalChapters={novelChapterCount(novel)}
        />

        <div className="min-w-0">
          <p className="m-0 mb-[10px] font-mono text-xs text-brand">
            第 {String(chapter.seq).padStart(3, "0")} 章 · {chapter.volumeTitle}
          </p>
          <h1 className="mt-0 mb-[36px] text-[clamp(28px,4vw,40px)] leading-[1.3]">{chapter.title}</h1>

          <article className="prose">
            <MarkdownContent content={reading.content} relativePath={reading.relativePath} assetPrefix="/novel-assets" />
          </article>

          <nav className="mt-[64px] grid grid-cols-2 gap-4 border-t-2 border-ink pt-[24px]" aria-label="章节导航">
            {prev ? (
              <Link className="group text-left no-underline" href={chapterHref(prev)}>
                <span className="block font-mono text-[11px] text-ink-muted">← 上一章</span>
                <span className="text-[16px] text-ink group-hover:text-pine">{prev.title}</span>
              </Link>
            ) : <span />}
            {next ? (
              <Link className="group text-right no-underline" href={chapterHref(next)}>
                <span className="block font-mono text-[11px] text-ink-muted">下一章 →</span>
                <span className="text-[16px] text-ink group-hover:text-pine">{next.title}</span>
              </Link>
            ) : <span />}
          </nav>

          <p className="mt-[28px] text-center font-mono text-[11px] text-ink-muted">
            <Link className="text-pine hover:underline" href={pageHref(`/novels/${encodePath(novel.slug)}/`)}>返回目录</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
