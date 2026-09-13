import Link from "next/link";
import { categoryFor, categoryLabel, getAllNotes } from "@/lib/notes";
import { encodePath, pageHref } from "@/lib/site";

function directoryFor(relativePath: string): string {
  return relativePath.split("/").slice(1, -1).join(" / ") || "根目录";
}

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
            <div className="directory-groups">
              {[...entries.reduce((groups, note) => {
                const directory = directoryFor(note.relativePath);
                groups.set(directory, [...(groups.get(directory) ?? []), note]);
                return groups;
              }, new Map<string, typeof entries>()).entries()].map(([directory, directoryNotes]) => (
                <section className="directory-group" key={directory}>
                  <h3>{directory}</h3>
                  <ul>
                    {directoryNotes.map((note) => (
                      <li key={note.relativePath}>
                        <Link href={pageHref(`/notes/${note.slug.map(encodePath).join("/")}/`)}>{note.title}</Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        ))}
      </section>

      {notes.length === 0 && <p className="empty-state">暂时还没有可展示的笔记。</p>}
    </div>
  );
}
