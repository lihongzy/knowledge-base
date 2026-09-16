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
    <div className="code-shell">
      <nav className="breadcrumbs" aria-label="面包屑">
        <Link href={pageHref("/")}>知识库</Link>
        <span>/</span>
        <span>源码</span>
        {segments.slice(0, -1).map((segment, index) => <span key={`${segment}-${index}`}>/ {segment}</span>)}
      </nav>
      <header className="code-header">
        <div>
          <p className="code-language">{extension}</p>
          <h1>{fileName}</h1>
          <p>{source.relativePath}</p>
        </div>
      </header>
      <section className="code-frame" aria-label={`${fileName} 源码`}>
        <div className="code-toolbar">
          <span>{fileName}</span>
          <div className="code-toolbar-actions">
            <span>{sourceLines.length} 行</span>
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
