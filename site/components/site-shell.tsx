"use client";
import Link from "next/link";
import { BookOpen, Bot, ChevronDown, Clapperboard, GitBranch, LibraryBig, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Starfield, ThemeToggle } from "@/components/magic-theme";
import { Button } from "@/components/ui/button";
import { SiteSearch } from "@/components/site-search";
import { topics } from "@/lib/navigation";
import { encodePath, pageHref, siteBasePath } from "@/lib/site";

export function SiteShell({ novels, children }: { novels: { slug: string; title: string }[]; children: React.ReactNode }) {
  const raw = usePathname();
  const pathname = decodeURI(siteBasePath && raw.startsWith(`${siteBasePath}/`) ? raw.slice(siteBasePath.length) : raw);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebarRef.current?.querySelector<HTMLElement>("a")?.focus();
    return () => { document.body.style.overflow = previous; menuRef.current?.focus(); };
  }, [menuOpen]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  const active = (slug: string, prefix: string) => (pathname === "/" && slug === "git") || pathname.startsWith(`/topics/${slug}`) || pathname.startsWith(`/notes/${prefix}/`) || pathname.startsWith(`/code/notes/${prefix}/`);
  const topicLink = (topic: (typeof topics)[number]) => {
    const Icon = topic.slug === "git" ? GitBranch : topic.slug === "agent" ? Bot : topic.slug === "novel-scraper" ? BookOpen : Clapperboard;
    return <Link key={topic.slug} href={pageHref(`/topics/${topic.slug}/`)} prefetch={false} className={cn("sidebar-link", active(topic.slug, topic.prefix) && "is-active")} aria-current={active(topic.slug, topic.prefix) ? "page" : undefined} onClick={() => setMenuOpen(false)}><Icon className="nav-glyph" aria-hidden="true" />{topic.label}<span className="nav-indicator" aria-hidden="true" /></Link>;
  };
  return <div className={cn("site-shell", sidebarCollapsed && "sidebar-collapsed")}>
    <Starfield />
    <a className="skip-link" href="#main-content">跳转到正文</a>
    {menuOpen && <button className="sidebar-backdrop" aria-label="关闭导航" onClick={() => setMenuOpen(false)} />}
    <aside ref={sidebarRef} id="site-navigation" className={cn("site-sidebar", menuOpen && "is-open")} aria-label="站点导航" onKeyDown={(event) => {
      if (!menuOpen || event.key !== "Tab") return;
      const items = sidebarRef.current?.querySelectorAll<HTMLElement>("a, summary");
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
      <Link className="sidebar-brand" href={pageHref("/")} onClick={() => setMenuOpen(false)}><span className="brand-orbit" aria-hidden="true"><LibraryBig /></span><span>梦梦的知识库<small>YUME / STAR ARCHIVE</small></span></Link>
      <nav className="sidebar-topics" aria-label="知识主题">
        <p className="sidebar-label">EXPLORE <span>知识主题</span></p>
        {topics.slice(0, 2).map(topicLink)}
        <details className="sidebar-group" open><summary>爬虫<ChevronDown className="nav-chevron" aria-hidden="true" /></summary><div className="sidebar-nested">{topics.slice(2).map(topicLink)}</div></details>
      </nav>
      <nav className="sidebar-novels" aria-label="小说资源">
        <p className="sidebar-label">LIBRARY <span>小说资源</span></p>
        {novels.map((novel) => {
          const selected = pathname.startsWith(`/novels/${novel.slug}`);
          return <Link key={novel.slug} href={pageHref(`/novels/${encodePath(novel.slug)}/`)} prefetch={false} className={cn("sidebar-link", selected && "is-active")} aria-current={selected ? "page" : undefined} onClick={() => setMenuOpen(false)}><BookOpen className="nav-glyph" aria-hidden="true" />{novel.title.replace(/\s+NO GAME NO LIFE/i, "")}</Link>;
        })}
        {novels.length === 0 && <p className="sidebar-label">暂无小说资源</p>}
      </nav>
      <p className="sidebar-signature">Keep learning. Keep dreaming. <span>✦</span></p>
    </aside>
    <div className="site-workspace">
      <header className="site-topbar">
        <div className="desktop-sidebar-control"><Button variant="ghost" size="icon" aria-controls="site-navigation" aria-expanded={!sidebarCollapsed} aria-label={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"} title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"} onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>{sidebarCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}</Button></div>
        <button ref={menuRef} className="mobile-menu-button" aria-controls="site-navigation" aria-label={menuOpen ? "关闭导航" : "打开导航"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button>
        <SiteSearch onOpen={() => setMenuOpen(false)} />
        <div className="topbar-actions"><span className="topbar-caption">PERSONAL KNOWLEDGE UNIVERSE <span aria-hidden="true">✦</span></span><ThemeToggle /></div>
      </header>
      <main id="main-content" className="workspace-content" tabIndex={-1}>{children}</main>
    </div>
  </div>;
}
