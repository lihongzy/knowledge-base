import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { pageHref } from "@/lib/site";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "梦梦的知识库",
  description: "个人知识笔记的静态展示站点",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={cn("font-sans", geist.variable)}>
      <body>
        <header className="flex min-h-[72px] items-center justify-between border-b border-line bg-[rgba(245,240,229,0.88)] px-[6vw] max-sm:px-6">
          <Link className="inline-flex items-baseline gap-3 no-underline" href={pageHref("/")}>
            <span className="font-mono text-xs tracking-[1px] text-brand">MENG</span>
            <strong className="text-[17px] font-bold">梦梦的知识库</strong>
          </Link>
          <nav className="flex items-center gap-[22px] font-mono text-xs">
            <Link className="text-ink-muted no-underline hover:text-pine" href={pageHref("/")}>笔记</Link>
            <Link className="text-ink-muted no-underline hover:text-pine" href={pageHref("/novels/")}>小说</Link>
            <p className="m-0 max-sm:hidden">Personal notes, carefully kept.</p>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="border-t border-line px-[6vw] py-[25px] font-mono text-[11px] text-ink-muted">Built from local Markdown notes.</footer>
      </body>
    </html>
  );
}
