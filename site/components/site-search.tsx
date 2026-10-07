"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, BookOpen, FileCode2 } from "lucide-react";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { assetHref } from "@/lib/site";
import type { createSearch, SearchPayload } from "@/lib/search";

type SearchRuntime = { index: ReturnType<typeof createSearch>; snippet: typeof import("@/lib/search").searchSnippet };
let cachedSearch: Promise<SearchRuntime> | undefined;
function loadSearch() {
  if (!cachedSearch) {
    cachedSearch = Promise.all([
      import("@/lib/search"),
      fetch(assetHref("/search-index.json"), { signal: AbortSignal.timeout(15000), cache: "no-cache" })
        .then(async (response) => {
          if (!response.ok) throw new Error("Search index unavailable");
          const payload: SearchPayload = await response.json();
          if (payload.version !== 1 || !Array.isArray(payload.documents)) throw new Error("Invalid search index");
          return payload;
        }),
    ]).then(([module, payload]) => ({ index: module.createSearch(payload.documents), snippet: module.searchSnippet }))
      .catch((error) => { cachedSearch = undefined; throw error; });
  }
  return cachedSearch;
}

export function SiteSearch({ onOpen }: { onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [runtime, setRuntime] = useState<SearchRuntime>();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const router = useRouter();
  const changeOpen = (next: boolean) => { setOpen(next); if (next) onOpen(); else setQuery(""); };

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.isComposing || event.repeat || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      setOpen((previous) => !previous);
      setQuery("");
      onOpen();
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [onOpen]);

  useEffect(() => {
    if (!open || runtime) return;
    let active = true;
    setStatus("loading");
    loadSearch().then((loaded) => { if (active) { setRuntime(loaded); setStatus("ready"); } })
      .catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [open, attempt, runtime]);

  const results = useMemo(() => {
    if (!runtime) return [];
    return deferredQuery.trim() ? runtime.index.search(deferredQuery) : runtime.index.documents.filter((doc) => doc.kind === "note").slice(0, 6);
  }, [runtime, deferredQuery]);

  return <CommandDialog open={open} onOpenChange={changeOpen} title="搜索知识库" description="搜索笔记标题、标签、正文，以及源码文件名和路径。" className="site-search-dialog" trigger={
    <DialogTrigger render={<button type="button" className="search-placeholder" aria-label="搜索笔记与源码" />}>
      <Search className="search-symbol" aria-hidden="true" /><span>搜索笔记、源码…</span><kbd className="search-status">Ctrl K</kbd>
    </DialogTrigger>
  }>
    <Command shouldFilter={false} label="知识库搜索" loop>
      <CommandInput autoFocus aria-label="搜索关键词" placeholder="搜索标题、正文或文件路径…" value={query} onValueChange={setQuery} />
      <CommandList>
        {status === "loading" && <CommandEmpty>正在加载搜索索引…</CommandEmpty>}
        {status === "error" && <CommandEmpty><p role="alert">搜索索引加载失败，请重试。</p><Button variant="outline" size="sm" onClick={() => setAttempt((value) => value + 1)}>重新加载</Button></CommandEmpty>}
        {status === "ready" && <>
          <CommandEmpty>{query.trim() ? "没有找到相关内容，试试更短的关键词。" : "暂无可搜索的内容。"}</CommandEmpty>
          {(["note", "source"] as const).map((kind) => {
            const entries = results.filter((entry) => entry.kind === kind);
            const Icon = kind === "note" ? BookOpen : FileCode2;
            return entries.length > 0 && <CommandGroup key={kind} heading={kind === "note" ? (query.trim() ? "笔记" : "浏览笔记") : "源码"}>
              {entries.map((entry) => <CommandItem key={entry.id} value={entry.id} onSelect={() => { changeOpen(false); router.push(entry.href); }}>
                <Icon aria-hidden="true" />
                <span className="search-result-body"><span className="search-result-title">{entry.title}</span><span className="search-result-path">{entry.path}</span>{entry.kind === "note" && entry.text && <span className="search-result-excerpt">{runtime?.snippet(entry.text, deferredQuery)}</span>}</span>
              </CommandItem>)}
            </CommandGroup>;
          })}
        </>}
      </CommandList>
    </Command>
    <div className="search-help"><span role="status" aria-live="polite">{status === "ready" ? (query.trim() ? `${results.length} 个结果（最多显示 30 个）` : "搜索笔记与源码 · 本地匹配") : "索引仅在首次打开时加载"}</span><span>↑↓ 选择 · ↵ 打开 · Esc 关闭</span></div>
  </CommandDialog>;
}
