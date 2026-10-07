import assert from "node:assert/strict";
import { parseNoteContent } from "../lib/note-content.ts";

const note = parseNoteContent('---\r\ntitle: "小说爬虫"\r\nupdated: "2026-10-02"\r\ntags: [爬虫, nodejs]\r\n---\r\n\r\n# 小说爬虫\r\n\r\n## 概述\r\n正文\r\n\r\n---\r\n结束', 'fallback');
assert.equal(note.title, '小说爬虫');
assert.equal(note.updated, '2026-10-02');
assert.deepEqual(note.tags, ['爬虫', 'nodejs']);
assert.equal(note.content, '## 概述\r\n正文\r\n\r\n---\r\n结束');
assert.equal(parseNoteContent('# 无元数据\n\n正文', 'fallback').title, '无元数据');
assert.equal(parseNoteContent('普通正文', 'fallback').content, '普通正文');
assert.deepEqual(parseNoteContent('---\ntags:\n  - Git\n  - Agent\nupdated: 2026-10-02\n---\n正文', 'fallback').tags, ['Git', 'Agent']);
console.log('PASS: frontmatter, CRLF, title fallback, tags, and body preservation');
