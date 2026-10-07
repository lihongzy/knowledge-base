"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ReadingOutline() {
  const pathname = usePathname();
  const [headings, setHeadings] = useState<{ id: string; title: string; nested: boolean }[]>([]);
  const [active, setActive] = useState("");
  useEffect(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>("#note-body h2, #note-body h3")];
    setHeadings(nodes.map((node) => ({ id: node.id, title: node.textContent ?? "", nested: node.tagName === "H3" })));
    setActive(nodes[0]?.id ?? "");
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: "-100px 0px -55% 0px" });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [pathname]);
  if (headings.length < 2) return null;
  return <aside className="reading-outline" aria-label="文章目录"><p>ON THIS PAGE <span>文章目录</span></p><nav>{headings.map((heading) => <a key={heading.id} href={`#${heading.id}`} className={cn(heading.nested && "is-nested", active === heading.id && "is-active")} aria-current={active === heading.id ? "location" : undefined} onClick={() => setActive(heading.id)}>{heading.title}</a>)}</nav><span className="outline-footnote">✦ 留下每一次探索的轨迹</span></aside>;
}
