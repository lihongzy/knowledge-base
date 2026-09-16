import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkdownContent } from "@/components/markdown-content";
import { categoryFor, categoryLabel, categoryNames, getAllNotes, getNote } from "@/lib/notes";
import { encodePath, pageHref } from "@/lib/site";

export const dynamicParams = false;

export async function generateStaticParams() {
  const notes = await getAllNotes();
  const categories = [...new Set(notes.map(categoryFor))].map((category) => ({ slug: [category] }));
  return [...categories, ...notes.map((note) => ({ slug: note.slug }))];
}

export default async function NotePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  if (slug.length === 1 && categoryNames[slug[0]]) {
    const notes = (await getAllNotes()).filter((item) => categoryFor(item) === slug[0]);
    return (
      <div className="mx-auto w-[min(1120px,calc(100%_-_48px))] max-w-[900px] pt-[46px] pb-[100px] max-sm:pt-[32px]">
        <nav className="mb-[56px] flex flex-wrap gap-[9px] font-mono text-xs text-ink-muted max-sm:mb-[34px]" aria-label="面包屑">
          <Link className="hover:text-pine" href={pageHref("/")}>知识库</Link><span>/</span><span>{categoryLabel(slug[0])}</span>
        </nav>
        <h1 className="m-0 mb-[30px] text-[44px]">{categoryLabel(slug[0])}</h1>
        <ul className="list-none border-t-2 border-ink p-0">
          {notes.map((item) => (
            <li className="grid grid-cols-[minmax(0,1fr)_260px] gap-5 border-b border-line py-[17px] max-sm:grid-cols-1 max-sm:gap-[5px]" key={item.relativePath}>
              <Link className="text-[18px]" href={pageHref(`/notes/${item.slug.map(encodePath).join("/")}/`)}>{item.title}</Link>
              <span className="font-mono text-[11px] text-right text-ink-muted [overflow-wrap:anywhere] max-sm:text-left">{item.relativePath.split("/").slice(1, -1).join(" / ") || "根目录"}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const note = await getNote(slug);
  if (!note) notFound();

  const segments = note.relativePath.replace(/\.md$/i, "").split("/");
  const category = segments[0];

  return (
    <div className="mx-auto w-[min(1120px,calc(100%_-_48px))] max-w-[900px] pt-[46px] pb-[100px] max-sm:pt-[32px]">
      <nav className="mb-[56px] flex flex-wrap gap-[9px] font-mono text-xs text-ink-muted max-sm:mb-[34px]" aria-label="面包屑">
        <Link className="hover:text-pine" href={pageHref("/")}>知识库</Link>
        <span>/</span>
        <Link className="hover:text-pine" href={pageHref(`/notes/${encodePath(category)}/`)}>{categoryLabel(category)}</Link>
        {segments.slice(1, -1).map((segment, index) => <span key={`${segment}-${index}`}>/ {segment}</span>)}
      </nav>
      <article className="prose">
        <MarkdownContent content={note.content} relativePath={note.relativePath} />
      </article>
    </div>
  );
}
