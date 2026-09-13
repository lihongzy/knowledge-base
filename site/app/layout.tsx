import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { pageHref } from "@/lib/site";

export const metadata: Metadata = {
  title: "梦梦的知识库",
  description: "个人知识笔记的静态展示站点",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <header className="site-header">
          <Link className="wordmark" href={pageHref("/")}>
            <span>MENG</span><strong>梦梦的知识库</strong>
          </Link>
          <p>Personal notes, carefully kept.</p>
        </header>
        <main>{children}</main>
        <footer>Built from local Markdown notes.</footer>
      </body>
    </html>
  );
}
