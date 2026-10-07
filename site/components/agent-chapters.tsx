import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { MagicCard } from "@/components/ui/magic-card";
import { chapterEntryTitle, groupAgentChapters } from "@/lib/agent-chapters";
import type { Note } from "@/lib/notes";
import { encodePath, pageHref } from "@/lib/site";

export function AgentChapters({ notes, prefix }: { notes: Note[]; prefix: string }) {
  return <div className="agent-chapters">{groupAgentChapters(notes, prefix).map((chapter) =>
    <section key={chapter.id} className="agent-chapter" aria-labelledby={`${chapter.id}-title`}>
      <MagicCard className="rounded-2xl" gradientColor="var(--magic-glow)" gradientFrom="var(--primary)" gradientTo="var(--pine)">
        <div className="chapter-content">
          <header className="chapter-header"><span className="chapter-number" aria-hidden="true">{chapter.number === undefined ? "START" : String(chapter.number).padStart(2, "0")}</span><h2 id={`${chapter.id}-title`}>{chapter.title}</h2><span className="chapter-count">{chapter.learning.length + chapter.code.length} 篇</span></header>
          <div className="chapter-sections" data-has-code={chapter.learning.length > 0 && chapter.code.length > 0}>
            {([{ key: "learning", label: "学习笔记", entries: chapter.learning }, { key: "code", label: chapter.id === "preparation" ? "环境与说明" : "代码案例", entries: chapter.code }]).filter((section) => section.entries.length > 0).map((section) =>
              <div className="chapter-section" key={section.key}>
                <h3>{section.label}</h3>
                <ul className="chapter-entry-list">{section.entries.map((note) => <li key={note.relativePath}>
                  <Link className="chapter-entry" href={pageHref(`/notes/${encodePath(note.slug.join("/"))}/`)} prefetch={false}><span>{chapterEntryTitle(note.title)}</span><ArrowUpRight aria-hidden="true" /></Link>
                </li>)}</ul>
              </div>)}
          </div>
        </div>
      </MagicCard>
    </section>)}</div>;
}
