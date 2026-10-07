import { getAllNotes } from "@/lib/notes";
import { getAllSourcePaths } from "@/lib/source-files";
import { encodePath, pageHref } from "@/lib/site";
import { searchableText, isSearchableSource } from "@/lib/search-content";
import type { SearchDocument, SearchPayload } from "@/lib/search";

export const dynamic = "force-static";

export async function GET() {
  const [notes, paths] = await Promise.all([getAllNotes(), getAllSourcePaths()]);
  const documents: SearchDocument[] = [
    ...notes.map((note): SearchDocument => ({
      id: `note:${note.relativePath}`, kind: "note", title: note.title,
      tags: note.tags.join(" "), path: note.relativePath,
      text: searchableText(note.content),
      href: pageHref(`/notes/${encodePath(note.slug.join("/"))}/`),
    })),
    ...paths.filter(isSearchableSource).map((path): SearchDocument => ({
      id: `source:${path}`, kind: "source", title: path.split("/").at(-1) ?? path,
      tags: "", path, text: "", href: pageHref(`/code/${encodePath(path)}/`),
    })),
  ];
  return Response.json({ version: 1, documents } satisfies SearchPayload);
}
