import Link from "next/link";
import { getNovels, getNovelCover, novelChapterCount } from "@/lib/novels";
import { assetHref, encodePath, pageHref } from "@/lib/site";
import { MagicCard } from "@/components/ui/magic-card";
import { BlurFade } from "@/components/ui/blur-fade";

export const dynamicParams = false;

export async function generateStaticParams() {
  const novels = await getNovels();
  return novels.map((novel) => ({ novel: novel.slug }));
}

export default async function NovelsPage() {
  const novels = await getNovels();
  const covers = await Promise.all(novels.map(getNovelCover));

  return (
    <div className="mx-auto w-[min(1120px,calc(100%_-_48px))] max-w-[900px] pt-[46px] pb-[100px] max-sm:pt-[32px]">
      <nav className="mb-[56px] flex flex-wrap gap-[9px] font-mono text-xs text-ink-muted max-sm:mb-[34px]" aria-label="面包屑">
        <Link className="hover:text-pine" href={pageHref("/")}>知识库</Link><span>/</span><span>小说</span>
      </nav>
      <BlurFade className="magic-reveal"><p className="mb-[22px] font-mono text-xs tracking-[1.4px] text-brand">✦ STORIES BEYOND THE STARS</p>
      <h1 className="m-0 mb-[20px] text-[44px]">星夜书架</h1>
      <p className="mt-0 mb-[40px] max-w-[470px] text-[15px] leading-[1.9] text-ink-muted">把故事收进星光里，随时回来接着读。</p></BlurFade>

      {novels.length === 0 && <p className="py-[80px] text-center text-ink-muted">暂时还没有小说。</p>}

      <ul className="list-none m-0 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6 p-0">
        {novels.map((novel, index) => (
          <li key={novel.id}>
            <MagicCard className="h-full rounded-2xl" gradientColor="var(--magic-glow)" gradientFrom="var(--primary)" gradientTo="var(--pine)"><Link
              className="novel-card"
              href={pageHref(`/novels/${encodePath(novel.slug)}/`)}
            >
              {covers[index] ? <img className="novel-cover" src={assetHref(`/novel-assets/${encodePath(covers[index]!)}`)} alt={`${novel.title} 插图`} loading="lazy" /> : <span className="novel-cover-mark" aria-hidden="true">✧</span>}
              <h2 className="m-0 text-ink">{novel.title}</h2>
              <p className="mt-[14px] mb-0 font-mono text-xs text-ink-muted">
                {novel.volumes.length} 卷 · {novelChapterCount(novel)} 章
              </p>
            </Link></MagicCard>
          </li>
        ))}
      </ul>
    </div>
  );
}
