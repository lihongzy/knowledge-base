import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getAllNotes, type Note } from "@/lib/notes";
import type { Topic } from "@/lib/navigation";
import { encodePath, pageHref } from "@/lib/site";
import { MagicCard } from "@/components/ui/magic-card";
import { BlurFade } from "@/components/ui/blur-fade";
import { AgentChapters } from "@/components/agent-chapters";

export async function TopicContent({ topic }: { topic: Topic }) {
  const notes = (await getAllNotes()).filter((note) => note.relativePath.startsWith(`${topic.prefix}/`)).sort((a, b) => a.relativePath.localeCompare(b.relativePath, "zh-CN", { numeric: true }));
  const groups = new Map<string, Note[]>();
  for (const note of notes) {
    const directory = note.relativePath.slice(topic.prefix.length + 1).split("/").slice(0, -1).join(" / ");
    const label = directory === "source-notes" ? "学习笔记" : directory || "笔记";
    groups.set(label, [...(groups.get(label) ?? []), note]);
  }
  return <div className="topic-page">
    <BlurFade className="magic-reveal"><header className="topic-header"><p className="topic-breadcrumb">知识主题 / {topic.label}</p><div className="topic-eyebrow">✦ KNOWLEDGE CONSTELLATION</div><h1>{topic.label}<span className="hero-title-dot">.</span></h1><p className="topic-description">{topic.description}</p><div className="hero-footer"><span>{String(notes.length).padStart(2, "0")} <small>篇笔记</small></span><span>学习 · 实践 · 归档</span></div><div className="constellation" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" /><span className="orbit-star">✦</span><span className="orbit-caption">{topic.slug.toUpperCase()} / ARCHIVE</span></div></header></BlurFade>
    <div className="topic-list-heading"><span>探索笔记 <small>THE COLLECTION</small></span><span>{notes.length} 篇</span></div>
    {topic.slug === "agent" ? <AgentChapters notes={notes} prefix={topic.prefix} /> : [...groups].sort(([a], [b]) => {
      const rank = (label: string) => label === "学习笔记" ? 0 : label === "code" ? 1 : 2;
      return rank(a) - rank(b) || a.localeCompare(b, "zh-CN", { numeric: true });
    }).map(([label, entries]) => <section className="topic-group" key={label} aria-label={label}>
      {groups.size > 1 && <h2>{label}</h2>}
      <ul className="note-list">{entries.map((note, index) => <li key={note.relativePath}><MagicCard className="h-full rounded-2xl" gradientColor="var(--magic-glow)" gradientFrom="var(--primary)" gradientTo="var(--pine)"><Link className="note-row" href={pageHref(`/notes/${encodePath(note.slug.join("/"))}/`)} prefetch={false}><span className="note-card-top"><span className="note-card-number">{String(index + 1).padStart(2, "0")} / {label === "学习笔记" ? "LEARNING" : label.startsWith("code") ? "CODE" : "NOTE"}</span><span className="note-row-arrow" aria-hidden="true"><ArrowUpRight /></span></span><span className="note-card-title">{note.title}</span><span className="note-card-meta">{note.tags.slice(0, 3).join(" · ") || "知识笔记"}{note.updated && <time dateTime={note.updated}>{note.updated}</time>}</span></Link></MagicCard></li>)}</ul>
    </section>)}
    {notes.length === 0 && <p className="topic-description">这个主题还没有笔记。</p>}
  </div>;
}
