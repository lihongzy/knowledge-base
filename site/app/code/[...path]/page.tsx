import Link from "next/link";
import { notFound } from "next/navigation";
import { codeToTokens, type BundledLanguage } from "shiki";
import { CopySourceButton } from "@/components/copy-source-button";
import { getAllSourceFiles, getSourceFile } from "@/lib/source-files";
import { pageHref } from "@/lib/site";

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getAllSourceFiles()).map((file) => ({ path: file.slug }));
}

export default async function SourcePage({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const source = await getSourceFile(path);
  if (!source) notFound();

  const segments = source.relativePath.split("/");
  const fileName = segments.at(-1) ?? source.relativePath;
  const fileExtension = fileName.split(".").at(-1)?.toLowerCase() ?? "";
  const extension = fileExtension.toUpperCase() || "SOURCE";
  const languages: Record<string, BundledLanguage> = {
    js: "javascript",
    jsx: "jsx",
    json: "json",
    ps1: "powershell",
    py: "python",
    sh: "bash",
    ts: "typescript",
    tsx: "tsx",
  };
  const { tokens: sourceLines } = await codeToTokens(source.content, {
    lang: languages[fileExtension] ?? "text",
    theme: "github-dark",
  });

  return (
    <div className="mx-auto w-[min(1360px,calc(100%_-_64px))] pt-[34px] pb-[100px] max-sm:w-[calc(100%_-_28px)] max-sm:pt-[24px]">
      <nav className="mb-[34px] flex flex-wrap gap-[9px] font-mono text-xs text-ink-muted max-sm:mb-[26px]" aria-label="面包屑">
        <Link className="hover:text-pine" href={pageHref("/")}>知识库</Link>
        <span>/</span>
        <span>源码</span>
        {segments.slice(0, -1).map((segment, index) => <span key={`${segment}-${index}`}>/ {segment}</span>)}
      </nav>
      <header className="mb-[22px] border-b border-line pb-[22px]">
        <div>
          <p className="mb-3 font-mono text-xs tracking-[1.2px] text-brand">{extension}</p>
          <h1 className="m-0 text-[34px] font-semibold max-sm:text-[27px]">{fileName}</h1>
          <p className="mt-[13px] font-mono text-xs text-ink-muted [overflow-wrap:anywhere]">{source.relativePath}</p>
        </div>
      </header>
      <section className="code-frame" aria-label={`${fileName} 源码`}>
        <div className="sticky top-0 z-10 flex min-h-[52px] items-center justify-between gap-3 rounded-t-[4px] border-b border-[rgba(232,234,219,0.14)] bg-[#1b3028] px-4 py-[9px] font-mono text-[11px] text-[#aab8aa] max-sm:px-[11px]">
          <span className="text-xs text-[#e0e9dc]">{fileName}</span>
          <div className="flex items-center gap-[14px] max-sm:gap-[9px]">
            <span className="whitespace-nowrap text-[#72877c]">{sourceLines.length} 行</span>
            <CopySourceButton source={source.content} />
          </div>
        </div>
        <pre className="source-code"><code>{sourceLines.map((line, index) => (
          <span className="source-line" key={index} id={`L${index + 1}`}>
            <span className="line-number" aria-hidden="true">{index + 1}</span>
            <span className="line-content" data-line-number={index + 1}>
              {line.map((token, tokenIndex) => (
                <span
                  key={tokenIndex}
                  style={{
                    color: token.color,
                    fontStyle: (token.fontStyle ?? 0) & 1 ? "italic" : undefined,
                    fontWeight: (token.fontStyle ?? 0) & 2 ? 700 : undefined,
                    textDecoration: (token.fontStyle ?? 0) & 4 ? "underline" : undefined,
                  }}
                >
                  {token.content}
                </span>
              ))}
            </span>
          </span>
        ))}</code></pre>
      </section>
    </div>
  );
}
