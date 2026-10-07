import path from "node:path";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { assetHref, encodePath, pageHref } from "@/lib/site";
import { isSourceFile, isUnderSourceRoot } from "@/lib/source-files";

type MarkdownContentProps = {
  content: string;
  relativePath: string;
  // 静态资源根路径：笔记默认 /note-assets，小说传入 /novel-assets
  assetPrefix?: string;
  // relativePath 的锚定基准：notes 相对（默认，笔记页）或仓库根相对（/files 渲染的外部文档）
  fileBase?: "notes" | "repo";
};

// 把链接目标解析为「仓库根相对」路径：
// - fileBase=notes：relativePath 相对 notes/，故先加上 notes/ 前缀再拼。
// - fileBase=repo：relativePath 已相对仓库根，直接拼。
function toRepoRelative(relativePath: string, pathname: string, fileBase: "notes" | "repo"): string {
  const baseDir = path.posix.dirname(relativePath);
  const repoBaseDir = fileBase === "repo" ? baseDir : path.posix.join("notes", baseDir);
  // react-markdown 会编码中文 href；根目录判断需要使用文件系统原始名称。
  return path.posix.normalize(path.posix.join(repoBaseDir, decodeURIComponent(pathname)));
}

// 仓库相对路径若落在 notes/ 下，返回其 notes 相对路径（用于 /notes 与 /note-assets），否则 null。
function toNotesRelative(repoRel: string): string | null {
  return repoRel.startsWith("notes/") ? repoRel.slice("notes/".length) : null;
}

function withHash(url: string, hash: string): string {
  return hash ? `${url}#${hash}` : url;
}

function resolveAsset(relativePath: string, source: string, assetPrefix = "/note-assets"): string {
  const [pathname, hash = ""] = source.split("#");
  if (pathname.startsWith("/") || /^[a-z]+:/i.test(pathname)) return source;
  const assetPath = path.posix.normalize(path.posix.join(path.posix.dirname(relativePath), pathname));
  return withHash(assetHref(`${assetPrefix}/${encodePath(assetPath)}`), hash);
}

type MarkdownNode = {
  type: string;
  depth?: number;
  value?: string;
  children?: MarkdownNode[];
  data?: object;
};

// Stable IDs also enable native Markdown anchors and the reading outline.
function remarkHeadingIds() {
  return (tree: MarkdownNode) => {
    const seen = new Map<string, number>();
    const textOf = (node: MarkdownNode): string => node.value ?? (node.children ?? []).map(textOf).join("");
    const visit = (node: MarkdownNode) => {
      if (node.type === "heading") {
        const base = textOf(node).trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s+/g, "-") || "section";
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        node.data = { ...node.data, hProperties: { id: count ? `${base}-${count}` : base } };
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}

function remarkAlerts() {
  return (tree: { children?: MarkdownNode[] }) => {
    for (const node of tree.children ?? []) {
      if (node.type !== "blockquote") continue;
      const paragraph = node.children?.[0];
      const text = paragraph?.children?.[0];
      const match = text?.value?.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/);
      if (!match || !text) continue;
      text.value = text.value?.slice(match[0].length);
      node.data = { hProperties: { className: ["markdown-alert", match[1].toLowerCase()] } };
    }
  };
}

export function MarkdownContent({ content, relativePath, assetPrefix = "/note-assets", fileBase = "notes" }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkAlerts, remarkHeadingIds]}
      components={{
        a: ({ href = "", children, ...props }) => {
          // 1) 页内锚点、外链：原样处理。
          if (href.startsWith("#")) return <a href={href} {...props}>{children}</a>;
          if (/^https?:\/\//i.test(href)) {
            return <a href={href} target="_blank" rel="noreferrer" {...props}>{children}</a>;
          }
          if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return <a href={href} {...props}>{children}</a>;

          // 2) 解析为仓库根相对路径。
          const [pathname, hash = ""] = href.split("#");
          const repoRel = toRepoRelative(relativePath, pathname, fileBase);
          const notesRel = toNotesRelative(repoRel);

          // 3) Markdown 文档链接：notes 内 → /notes 笔记页；越出 notes（如项目 README）→ /files 站内渲染。
          if (/\.md$/i.test(pathname)) {
            if (notesRel !== null) {
              const notePath = notesRel.replace(/\.md$/i, "");
              return <Link href={withHash(pageHref(`/notes/${encodePath(notePath)}/`), hash)} {...props}>{children}</Link>;
            }
            return <a href={withHash(assetHref(`/files/${encodePath(repoRel)}/`), hash)} {...props}>{children}</a>;
          }

          // 4) 源码文件链接 → /code 语法高亮页（按仓库根相对路径）。
          if (isSourceFile(repoRel) && isUnderSourceRoot(repoRel)) {
            return <a href={withHash(assetHref(`/code/${encodePath(repoRel)}/`), hash)} {...props}>{children}</a>;
          }

          // 5) 其余（图片、附件等资源）→ /note-assets 或 /novel-assets。
          return <a href={resolveAsset(relativePath, href, assetPrefix)} {...props}>{children}</a>;
        },
        img: ({ src, alt = "" }) => <img src={resolveAsset(relativePath, typeof src === "string" ? src : "", assetPrefix)} alt={alt} />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
