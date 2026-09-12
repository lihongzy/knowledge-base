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
      <div className="note-shell category-page">
        <nav className="breadcrumbs" aria-label="面包屑"><Link href={pageHref("/")}>知识库</Link><span>/</span><span>{categoryLabel(slug[0])}</span></nav>
        <h1>{categoryLabel(slug[0])}</h1>
        <ul className="category-note-list">
          {notes.map((item) => <li key={item.relativePath}><Link href={pageHref(`/notes/${item.slug.map(encodePath).join("/")}/`)}>{item.title}</Link><span>{item.relativePath.split("/").slice(1, -1).join(" / ") || "根目录"}</span></li>)}
        </ul>
      </div>
    );
  }
  const note = await getNote(slug);
  if (!note) notFound();

  const segments = note.relativePath.replace(/\.md$/i, "").split("/");
  const category = segments[0];

  return (
    <div className="note-shell">
      <nav className="breadcrumbs" aria-label="面包屑">
        <Link href={pageHref("/")}>知识库</Link>
        <span>/</span>
        <Link href={pageHref(`/notes/${encodePath(category)}/`)}>{categoryLabel(category)}</Link>
        {segments.slice(1, -1).map((segment, index) => <span key={`${segment}-${index}`}>/ {segment}</span>)}
      </nav>
      <article className="prose">
        <MarkdownContent content={note.content} relativePath={note.relativePath} />
      </article>
    </div>
  );
}
