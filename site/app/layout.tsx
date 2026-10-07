import type { Metadata } from "next";
import "./globals.css";
import { SiteShell } from "@/components/site-shell";
import { getNovels } from "@/lib/novels";
import { MagicTheme } from "@/components/magic-theme";
export const metadata: Metadata = { title: "梦梦的知识库", description: "个人知识笔记与小说资源" };
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const novels = (await getNovels()).map(({ slug, title }) => ({ slug, title }));
  return <html lang="zh-CN" className="light" suppressHydrationWarning><body><MagicTheme><SiteShell novels={novels}>{children}</SiteShell></MagicTheme><noscript><style>{`.magic-reveal { opacity: 1 !important; filter: none !important; transform: none !important; }`}</style></noscript></body></html>;
}
