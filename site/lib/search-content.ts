// Search publishes prose, not code fences or credential-bearing lines.
export function searchableText(markdown: string): string {
  return markdown
    .replace(/```[^\n]*\n[\s\S]*?```|~~~[^\n]*\n[\s\S]*?~~~/g, " ")
    .replace(/^.*(?:cookie|authorization|password|secret|api[_-]?key|access[_-]?token|cf_clearance)\s*[=:：].*$/gim, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/^[\s#>*|_-]+/gm, "")
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ").trim();
}

export function isSearchableSource(path: string) {
  return !/(?:^|\/)(?:credentials?|secrets?|cookies?|tokens?)(?:\.[^/]*)?$/i.test(path);
}
