import Link from "next/link";
import { notFound } from "next/navigation";
import { getNovel, getNovels, novelChapterCount } from "@/lib/novels";
import { encodePath, pageHref } from "@/lib/site";

export const dynamicParams = false;

export async function generateStaticParams() {
  const novels = await getNovels();
  return novels.map((novel) => ({ novel: novel.slug }));
}

export default async function NovelOverviewPage({
  params,
}: {
  params: Promise<{ novel: string }>;
}) {
  const { novel: novelId } = await params;
  const novel = await getNovel(novelId);
  if (!novel) notFound();

  return (
    <div className="mx-auto w-[min(1120px,calc(100%_-_48px))] max-w-[900px] pt-[46px] pb-[100px] max-sm:pt-[32px]">
      <nav className="mb-[56px] flex flex-wrap gap-[9px] font-mono text-xs text-ink-muted max-sm:mb-[34px]" aria-label="面包屑">
        <Link className="hover:text-pine" href={pageHref("/")}>知识库</Link>
        <span>/</span>
        <Link className="hover:text-pine" href={pageHref("/novels/")}>小说</Link>
        <span>/</span>
        <span>{novel.title}</span>
      </nav>

      <h1 className="m-0 mb-[14px] text-[40px] leading-[1.25]">{novel.title}</h1>
      <p className="mt-0 mb-[40px] font-mono text-xs text-ink-muted">
        {novel.volumes.length} 卷 · {novelChapterCount(novel)} 章
        {novel.sourceCatalog && (
          <>
            {" · "}
            <a className="text-pine hover:underline" href={novel.sourceCatalog} target="_blank" rel="noreferrer">原始目录</a>
          </>
        )}
      </p>

      <div className="border-t-2 border-ink">
        {novel.volumes.map((volume, index) => (
          <details className="border-b border-line" key={`${volume.title}-${index}`} open={index === 0}>
            <summary className="flex cursor-pointer list-none items-baseline gap-4 py-[18px] marker:content-none">
              <span className="font-mono text-xs text-brand">{String(index + 1).padStart(2, "0")}</span>
              <h2 className="m-0 flex-1 text-[19px] font-semibold leading-[1.5]">{volume.title}</h2>
              <em className="font-mono text-[11px] not-italic text-ink-muted">{volume.chapters.length} 章</em>
            </summary>
            <ul className="m-0 list-none px-[8px] pb-[22px]">
              {volume.chapters.map((chapter) => (
                <li className="border-t border-dotted border-line py-[10px]" key={chapter.file}>
                  <Link
                    className="text-[17px] decoration-1 hover:text-pine"
                    href={pageHref(`/novels/${encodePath(novel.slug)}/${encodePath(chapter.slug)}/`)}
                  >
                    <span className="mr-[12px] font-mono text-[11px] text-ink-muted">{String(chapter.seq).padStart(3, "0")}</span>
                    {chapter.title}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </div>
  );
}
