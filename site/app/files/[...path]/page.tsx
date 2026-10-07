import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkdownContent } from "@/components/markdown-content";
import { getAllRepoDocs, getRepoDoc } from "@/lib/repo-docs";
import { pageHref } from "@/lib/site";
import { parseNoteContent } from "@/lib/note-content";

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getAllRepoDocs()).map((doc) => ({ path: doc.slug }));
}

export default async function RepoDocPage({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const doc = await getRepoDoc(path);
  if (!doc) notFound();

  const segments = doc.relativePath.split("/");
  const fileName = segments.at(-1) ?? doc.relativePath;
  const parsed = parseNoteContent(doc.content, doc.title || fileName.replace(/\.md$/i, ""));
  const title = parsed.title;

  return (
    <div className="mx-auto w-[min(1120px,calc(100%_-_48px))] max-w-[900px] pt-[46px] pb-[100px] max-sm:pt-[32px]">
      <nav className="mb-[56px] flex flex-wrap gap-[9px] font-mono text-xs text-ink-muted max-sm:mb-[34px]" aria-label="面包屑">
        <Link className="hover:text-pine" href={pageHref("/")}>知识库</Link>
        <span>/</span>
        <span>文档</span>
        {segments.slice(0, -1).map((segment, index) => <span key={`${segment}-${index}`}>/ {segment}</span>)}
      </nav>
      <header className="mb-[30px] border-b border-line pb-[22px]">
        <p className="mb-3 font-mono text-xs tracking-[1.2px] text-brand">MARKDOWN</p>
        <h1 className="m-0 text-[40px] max-sm:text-[28px]">{title}</h1>
        <p className="mt-[11px] font-mono text-xs text-ink-muted [overflow-wrap:anywhere]">{doc.relativePath}</p>
      </header>
      <article className="prose">
        {/* relativePath 为仓库根相对路径，fileBase=repo 让其中链接再按仓库根解析 */}
        <MarkdownContent content={parsed.content} relativePath={doc.relativePath} fileBase="repo" />
      </article>
    </div>
  );
}
