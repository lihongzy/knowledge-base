"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { NovelMeta } from "@/lib/novels";
import { encodePath, pageHref } from "@/lib/site";

type NovelTocProps = {
  novel: NovelMeta;
  currentSlug: string;
  totalChapters: number;
};

// 把当前章滚到某个可滚动容器的可视中部（手动算 scrollTop，避免连带滚动页面）
function scrollActiveIntoView(container: HTMLElement | null) {
  if (!container) return;
  const active = container.querySelector<HTMLElement>("[data-toc-active]");
  if (!active) return;
  const target = active.offsetTop - container.clientHeight / 2 + active.clientHeight / 2;
  container.scrollTop = Math.max(0, target);
}

// 卷 -> 章节的目录列表；aside 与移动端抽屉共用，active 项带 data-toc-active 供定位
function TocList({
  novel,
  currentSlug,
  onClickLink,
}: {
  novel: NovelMeta;
  currentSlug: string;
  onClickLink?: () => void;
}) {
  return (
    <nav aria-label="小说目录">
      {novel.volumes.map((volume, volumeIndex) => {
        const containsActive = volume.chapters.some((c) => c.slug === currentSlug);
        return (
          <details
            className="border-b border-line last:border-b-0"
            key={`${volume.title}-${volumeIndex}`}
            open={containsActive}
          >
            <summary className="flex cursor-pointer list-none items-baseline gap-[8px] py-[10px] text-[14px] marker:content-none">
              <span className="shrink-0 font-mono text-[11px] text-brand">
                {String(volumeIndex + 1).padStart(2, "0")}
              </span>
              <span className="line-clamp-2 flex-1 font-semibold leading-[1.45] text-ink">
                {volume.title}
              </span>
              <em className="shrink-0 font-mono text-[10px] not-italic text-ink-muted">
                {volume.chapters.length}
              </em>
            </summary>
            <ul className="m-0 mb-[8px] list-none p-0">
              {volume.chapters.map((chapter) => {
                const href = pageHref(
                  `/novels/${encodePath(novel.slug)}/${encodePath(chapter.slug)}/`,
                );
                const label = (
                  <>
                    <span className="mr-[8px] shrink-0 font-mono text-[10px] text-ink-muted">
                      {String(chapter.seq).padStart(3, "0")}
                    </span>
                    <span className="line-clamp-2 leading-[1.5]">{chapter.title}</span>
                  </>
                );
                if (chapter.slug === currentSlug) {
                  return (
                    <li className="m-0" key={chapter.file}>
                      <span
                        data-toc-active
                        aria-current="page"
                        className="flex items-baseline gap-0 rounded-lg border-l-2 border-primary bg-accent px-[8px] py-[6px] text-[13px] font-semibold text-primary"
                      >
                        {label}
                      </span>
                    </li>
                  );
                }
                return (
                  <li className="m-0" key={chapter.file}>
                    <Link
                      className="flex items-baseline rounded-[4px] px-[8px] py-[6px] text-[13px] text-ink no-underline hover:bg-paper-deep hover:text-pine"
                      href={href}
                      onClick={onClickLink}
                    >
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </nav>
  );
}

export function NovelToc({ novel, currentSlug, totalChapters }: NovelTocProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const asideRef = useRef<HTMLElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // 桌面侧栏：挂载后定位到当前章
  useEffect(() => {
    scrollActiveIntoView(asideRef.current);
  }, []);

  // 抽屉打开时定位到当前章
  useEffect(() => {
    if (drawerOpen) scrollActiveIntoView(drawerRef.current);
  }, [drawerOpen]);

  // 打开抽屉时锁定背景滚动
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  return (
    <>
      {/* 桌面：sticky 侧栏（作为 grid 第一列） */}
      <aside
        ref={asideRef}
        className="novel-toc sticky hidden self-start overflow-y-auto border border-line p-[16px] lg:block"
      >
        <div className="mb-[12px] border-b border-line pb-[12px]">
          <Link
            className="line-clamp-2 text-[15px] font-semibold text-ink no-underline hover:text-pine"
            href={pageHref(`/novels/${encodePath(novel.slug)}/`)}
          >
            {novel.title}
          </Link>
          <p className="m-0 mt-[4px] font-mono text-[11px] text-ink-muted">
            {novel.volumes.length} 卷 · {totalChapters} 章
          </p>
        </div>
        <TocList novel={novel} currentSlug={currentSlug} />
      </aside>

      {/* 移动端：悬浮「目录」按钮 */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="fixed bottom-[22px] left-[22px] z-40 rounded-full border border-line bg-paper-deep px-[18px] py-[10px] font-mono text-xs text-ink shadow-[0_6px_20px_rgba(22,34,28,0.18)] lg:hidden"
        aria-label="打开目录"
      >
        ☰ 目录
      </button>

      {/* 移动端：抽屉 */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="小说目录">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-label="关闭目录"
          />
          <div
            ref={drawerRef}
            className="relative h-full w-[86%] max-w-[340px] overflow-y-auto border-r border-line bg-paper p-[18px]"
          >
            <div className="mb-[14px] flex items-start justify-between gap-3 border-b border-line pb-[12px]">
              <div>
                <Link
                  className="line-clamp-2 text-[16px] font-semibold text-ink no-underline hover:text-pine"
                  href={pageHref(`/novels/${encodePath(novel.slug)}/`)}
                  onClick={() => setDrawerOpen(false)}
                >
                  {novel.title}
                </Link>
                <p className="m-0 mt-[4px] font-mono text-[11px] text-ink-muted">
                  {novel.volumes.length} 卷 · {totalChapters} 章
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="shrink-0 rounded-[4px] border border-line px-[10px] py-[4px] font-mono text-xs text-ink-muted"
                aria-label="关闭目录"
              >
                ✕
              </button>
            </div>
            <TocList novel={novel} currentSlug={currentSlug} onClickLink={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
