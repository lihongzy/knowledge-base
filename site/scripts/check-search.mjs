import assert from "node:assert/strict";
import { createSearch, searchSnippet, tokenize } from "../lib/search.ts";
import { searchableText, isSearchableSource } from "../lib/search-content.ts";

const doc = (id, title, text = "", kind = "note", path = id) => ({ id, title, text, kind, path, tags: "", href: `/notes/${id}/` });
const search = createSearch([
  doc("git", "Git 命令练习手册", "团队协作和回滚"),
  doc("scraper", "小说爬虫", "三阶段流水线，抓取目录和下载插图"),
  doc("source", "downloadVideo.js", "", "source", "动漫/从0开始的异世界/downloadVideo.js"),
  doc("agent", "AgentScope 案例", "智能体学习笔记"),
]);
assert.equal(search.search("爬虫")[0]?.id, "scraper");
assert.equal(search.search("流水线")[0]?.id, "scraper");
assert.equal(search.search("Git 命令")[0]?.id, "git");
assert.equal(search.search("downloadVid")[0]?.kind, "source");
assert.equal(search.search("从0开始")[0]?.id, "source");
assert.equal(search.search("agentscop")[0]?.id, "agent");
assert.deepEqual(search.search("不存在的内容abcdef"), []);
assert.deepEqual(search.search("   "), []);
assert.deepEqual(tokenize("爬虫"), ["爬虫"]);
assert.ok(searchSnippet("前文".repeat(40) + "下载插图", "下载").includes("下载"));
const safe = searchableText("## 正文\n[学习](https://example.com)\n```js\nconst COOKIE = 'private';\n```\npassword: hidden\n访问 https://example.com/?token=hidden");
assert.ok(!/private|hidden|https:/.test(safe));
assert.ok(safe.includes("学习"));
assert.equal(isSearchableSource("tools/credentials.json"), false);
assert.equal(isSearchableSource("tools/scratch.js"), true);

const response = await fetch(process.env.SEARCH_TEST_URL ?? "http://127.0.0.1:3001/search-index.json");
assert.equal(response.status, 200);
const payload = await response.json();
assert.equal(payload.version, 1);
assert.ok(payload.documents.length > 0);
assert.equal(new Set(payload.documents.map((d) => d.id)).size, payload.documents.length);
assert.ok(payload.documents.every((d) => d.kind !== "source" || d.text === ""));
assert.ok(payload.documents.every((d) => !/\/videos\/.*\.ts$/i.test(d.path)));
const live = createSearch(payload.documents);
assert.ok(live.search("Git").some((d) => d.kind === "note"));
assert.ok(live.search("downloadVideo").some((d) => d.kind === "source"));
assert.ok(live.search("爬虫").length > 0);
console.log(`PASS: Chinese, mixed queries, prefix, ranking, snippets, sanitization, and ${payload.documents.length} live search documents`);
