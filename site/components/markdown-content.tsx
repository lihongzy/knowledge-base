import path from "node:path";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { assetHref, encodePath, pageHref } from "@/lib/site";
import { isSourceFile } from "@/lib/source-files";

type MarkdownContentProps = {
  content: string;
  relativePath: string;
};

function resolveInternalLink(relativePath: string, href: string): string {
  const [pathname, hash = ""] = href.split("#");
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(relativePath), pathname));
  const withoutExtension = target.replace(/\.md$/i, "");
  return `${pageHref(`/notes/${encodePath(withoutExtension)}/`)}${hash ? `#${hash}` : ""}`;
}

function resolveAsset(relativePath: string, source: string): string {
  const [pathname, hash = ""] = source.split("#");
  if (pathname.startsWith("/") || /^[a-z]+:/i.test(pathname)) return source;
  const assetPath = path.posix.normalize(path.posix.join(path.posix.dirname(relativePath), pathname));
  return `${assetHref(`/note-assets/${encodePath(assetPath)}`)}${hash ? `#${hash}` : ""}`;
}

function resolveSourceLink(relativePath: string, href: string): string {
  const [pathname, hash = ""] = href.split("#");
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(relativePath), pathname));
  return `${assetHref(`/code/${encodePath(target)}/index.html`)}${hash ? `#${hash}` : ""}`;
}

type MarkdownNode = {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: object;
};

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

export function MarkdownContent({ content, relativePath }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkAlerts]}
      components={{
        a: ({ href = "", children, ...props }) => {
          if (/\.md(?:#.*)?$/i.test(href) && !/^[a-z]+:/i.test(href)) {
            return <Link href={resolveInternalLink(relativePath, href)} {...props}>{children}</Link>;
          }
          if (/^https?:\/\//i.test(href)) {
            return <a href={href} target="_blank" rel="noreferrer" {...props}>{children}</a>;
          }
          if (!href.startsWith("#") && !/^[a-z]+:/i.test(href)) {
            const pathname = href.split("#")[0];
            const target = path.posix.normalize(path.posix.join(path.posix.dirname(relativePath), pathname));
            if (isSourceFile(target)) {
              return <a href={resolveSourceLink(relativePath, href)} {...props}>{children}</a>;
            }
          }
          if (!href.startsWith("#") && !/^[a-z]+:/i.test(href)) {
            return <a href={resolveAsset(relativePath, href)} {...props}>{children}</a>;
          }
          return <a href={href} {...props}>{children}</a>;
        },
        img: ({ src, alt = "" }) => <img src={resolveAsset(relativePath, typeof src === "string" ? src : "")} alt={alt} />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
