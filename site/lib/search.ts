import MiniSearch from "minisearch";

export type SearchDocument = {
  id: string;
  kind: "note" | "source";
  title: string;
  tags: string;
  path: string;
  text: string;
  href: string;
};
export type SearchPayload = { version: 1; documents: SearchDocument[] };

export function tokenize(text: string): string[] {
  const runs = text.normalize("NFKC").toLowerCase().match(/[\p{Script=Han}]+|[\p{L}\p{N}_]+/gu) ?? [];
  return runs.flatMap((run) => {
    if (!/\p{Script=Han}/u.test(run)) return [run];
    const chars = [...run];
    return chars.length === 1 ? chars : chars.slice(0, -1).map((char, i) => char + chars[i + 1]);
  });
}

export function createSearch(documents: SearchDocument[]) {
  const engine = new MiniSearch<SearchDocument>({
    fields: ["title", "tags", "path", "text"],
    storeFields: ["kind", "title", "path", "text", "href"],
    tokenize,
    searchOptions: {
      boost: { title: 6, path: 3, tags: 4, text: 1 },
      combineWith: "AND",
      prefix: (term) => !/\p{Script=Han}/u.test(term),
      fuzzy: (term) => /^[a-z]{5,}$/i.test(term) ? 0.15 : false,
    },
  });
  engine.addAll(documents);
  return {
    documents,
    search(query: string): SearchDocument[] {
      if (!tokenize(query).length) return [];
      return engine.search(query.trim()).slice(0, 30).map((result) => ({
        id: String(result.id), kind: result.kind, title: result.title,
        path: result.path, text: result.text, href: result.href, tags: "",
      }));
    },
  };
}

export function searchSnippet(text: string, query: string) {
  const terms = tokenize(query);
  const normalized = text.toLowerCase();
  const positions = terms.map((term) => normalized.indexOf(term)).filter((index) => index >= 0);
  const start = Math.max(0, (positions.length ? Math.min(...positions) : 0) - 28);
  const excerpt = text.slice(start, start + 110);
  return `${start ? "…" : ""}${excerpt}${start + 110 < text.length ? "…" : ""}`;
}
