import Link from "next/link";
import { getNovels, novelChapterCount } from "@/lib/novels";
import { encodePath, pageHref } from "@/lib/site";

export const dynamicParams = false;

export async function generateStaticParams() {
  const novels = await getNovels();
  return novels.map((novel) => ({ novel: novel.slug }));
}

export default async function NovelsPage() {
  const novels = await getNovels();

  return (
    <div className="mx-auto w-[min(1120px,calc(100%_-_48px))] max-w-[900px] pt-[46px] pb-[100px] max-sm:pt-[32px]">
      <nav className="mb-[56px] flex flex-wrap gap-[9px] font-mono text-xs text-ink-muted max-sm:mb-[34px]" aria-label="面包屑">
        <Link className="hover:text-pine" href={pageHref("/")}>知识库</Link><span>/</span><span>小说</span>
      </nav>
      <p className="mb-[22px] font-mono text-xs tracking-[1.4px] text-brand">NOVEL SHELF</p>
      <h1 className="m-0 mb-[30px] text-[44px]">小说</h1>
      <p className="mt-0 mb-[40px] max-w-[470px] text-[17px] leading-[1.9] text-ink-muted">抓下来、按卷归档的小说，随时回来接着读。</p>

      {novels.length === 0 && <p className="py-[80px] text-center text-ink-muted">暂时还没有小说。</p>}

      <ul className="list-none m-0 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6 p-0">
        {novels.map((novel) => (
          <li key={novel.id}>
            <Link
              className="block h-full border border-line border-t-[3px] border-t-brand bg-paper-deep p-[22px] no-underline transition-colors hover:border-pine"
              href={pageHref(`/novels/${encodePath(novel.slug)}/`)}
            >
              <h2 className="m-0 text-[22px] leading-[1.4] text-ink">{novel.title}</h2>
              <p className="mt-[14px] mb-0 font-mono text-xs text-ink-muted">
                {novel.volumes.length} 卷 · {novelChapterCount(novel)} 章
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
