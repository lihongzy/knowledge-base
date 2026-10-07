import { JSON_SCHEMA, load } from "js-yaml";

export function parseNoteContent(raw: string, fallback: string) {
  let content = raw.replace(/^\uFEFF/, "");
  let metadata: Record<string, unknown> = {};
  const frontmatter = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (frontmatter) {
    const parsed: unknown = load(frontmatter[1], { schema: JSON_SCHEMA });
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      metadata = parsed as Record<string, unknown>;
    }
    content = content.slice(frontmatter[0].length).trimStart();
  }
  const heading = content.match(/^#\s+(.+?)(?:\r?\n|$)/);
  const title = typeof metadata.title === "string" && metadata.title.trim()
    ? metadata.title.trim() : heading?.[1].trim() || fallback;
  // 文章标题统一由页面头部展示，只移除正文开头的一级标题。
  if (heading) content = content.slice(heading[0].length).trimStart();
  const updated = typeof metadata.updated === "string" && /^\d{4}-\d{2}-\d{2}$/.test(metadata.updated)
    ? metadata.updated : undefined;
  const tags = Array.isArray(metadata.tags)
    ? metadata.tags.filter((tag): tag is string => typeof tag === "string" && Boolean(tag.trim())).map((tag) => tag.trim())
    : [];
  return { content, title, updated, tags: [...new Set(tags)] };
}
