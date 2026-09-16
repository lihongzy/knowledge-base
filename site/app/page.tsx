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
    <div className="mx-auto w-[min(1120px,calc(100%_-_48px))] pt-[10vh] pb-[12vh] max-sm:w-[min(100%_-_32px,1120px)] max-sm:pt-[7vh]">
      <section className="max-w-[760px] pt-[2vh] pb-[10vh] max-sm:pb-[7vh]">
        <p className="mb-[22px] font-mono text-xs tracking-[1.4px] text-brand">KNOWLEDGE ARCHIVE</p>
        <h1 className="m-0 text-[clamp(42px,6.5vw,82px)] leading-[1.15] font-semibold">把学习过的，<br />留在手边。</h1>
        <p className="mt-[30px] mb-[22px] max-w-[470px] text-[17px] leading-[1.9] text-ink-muted">这里收录项目经验、长期关注的领域，以及值得反复查阅的资料。</p>
        <span className="border-t border-ink pt-[10px] font-mono text-xs">{notes.length} 篇笔记</span>
      </section>

      <section className="border-t-2 border-ink" aria-label="笔记分类">
        {[...categories.entries()].map(([category, entries], index) => (
          <div className="border-b border-line pt-[26px] pb-[32px]" key={category}>
            <div className="grid grid-cols-[52px_1fr_auto] items-baseline max-sm:grid-cols-[38px_1fr_auto]">
              <span className="font-mono text-xs text-brand">0{index + 1}</span>
              <h2 className="m-0 text-[25px] font-semibold">{categoryLabel(category)}</h2>
              <em className="font-mono text-xs not-italic text-ink-muted">{entries.length}</em>
            </div>
            <div className="mt-[24px] ml-[52px] max-sm:ml-0">
              {[...entries.reduce((groups, note) => {
                const directory = directoryFor(note.relativePath);
                groups.set(directory, [...(groups.get(directory) ?? []), note]);
                return groups;
              }, new Map<string, typeof entries>()).entries()].map(([directory, directoryNotes]) => (
                <section className="mt-[26px] first:mt-0" key={directory}>
                  <h3 className="m-0 font-mono text-xs font-medium text-pine">{directory}</h3>
                  <ul className="mt-[10px] list-none p-0">
                    {directoryNotes.map((note) => (
                      <li className="border-t border-dotted border-line py-3" key={note.relativePath}>
                        <Link className="text-[17px] decoration-1 hover:text-pine" href={pageHref(`/notes/${note.slug.map(encodePath).join("/")}/`)}>{note.title}</Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        ))}
      </section>

      {notes.length === 0 && <p className="py-[80px] text-center text-ink-muted">暂时还没有可展示的笔记。</p>}
    </div>
  );
}
