import Link from "next/link";
import { categoryFor, categoryLabel, getAllNotes } from "@/lib/notes";
import { encodePath, siteHref } from "@/lib/site";

export default async function HomePage() {
  const notes = await getAllNotes();
  const categories = new Map<string, typeof notes>();
  for (const note of notes) {
    const category = categoryFor(note);
    categories.set(category, [...(categories.get(category) ?? []), note]);
  }

  return (
    <div className="home-shell">
      <section className="intro">
        <p className="eyebrow">KNOWLEDGE ARCHIVE</p>
        <h1>把学习过的，<br />留在手边。</h1>
        <p className="intro-copy">这里收录项目经验、长期关注的领域，以及值得反复查阅的资料。</p>
        <span className="note-count">{notes.length} 篇笔记</span>
      </section>

      <section className="categories" aria-label="笔记分类">
        {[...categories.entries()].map(([category, entries], index) => (
          <div className="category-block" key={category}>
            <div className="category-heading">
              <span>0{index + 1}</span>
              <h2>{categoryLabel(category)}</h2>
              <em>{entries.length}</em>
            </div>
            <ul>
              {entries.map((note) => (
                <li key={note.relativePath}>
                  <Link href={siteHref(`/notes/${note.slug.map(encodePath).join("/")}/`)}>{note.title}</Link>
                  <span>{note.relativePath.split("/").slice(1, -1).join(" / ") || "根目录"}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {notes.length === 0 && <p className="empty-state">暂时还没有可展示的笔记。</p>}
    </div>
  );
}
