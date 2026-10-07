import type { Note } from "./notes";

export type AgentChapter = {
  id: string;
  number?: number;
  title: string;
  learning: Note[];
  code: Note[];
};

function chapterLabel(number: number) {
  const digits = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  const chinese = number < 10 ? digits[number] : number < 100
    ? `${number >= 20 ? digits[Math.floor(number / 10)] : ""}十${digits[number % 10]}` : String(number);
  return `第${chinese}章`;
}

export function chapterEntryTitle(title: string) {
  return title.replace(/^第[一二三四五六七八九十百零〇\d]+章\s*[:：、.\-—]?\s*/, "").trim() || title;
}

export function groupAgentChapters(notes: Note[], prefix: string): AgentChapter[] {
  const groups = new Map<string, AgentChapter>();
  for (const note of notes) {
    const relative = note.relativePath.slice(prefix.length + 1);
    const match = relative.match(/(?:^|\/)chapter(\d+)(?=[-/]|\.md$)/i);
    const number = match ? Number(match[1]) : undefined;
    const preparation = relative === "code/README.md";
    const id = number !== undefined ? `chapter-${number}` : preparation ? "preparation" : "other";
    let group = groups.get(id);
    if (!group) {
      group = { id, number, title: number !== undefined ? chapterLabel(number) : preparation ? "准备工作" : "其他资料", learning: [], code: [] };
      groups.set(id, group);
    }
    (relative.startsWith("code/") ? group.code : group.learning).push(note);
  }
  const rank = (group: AgentChapter) => group.id === "preparation" ? -1 : group.number ?? Infinity;
  const compare = (a: Note, b: Note) => a.relativePath.localeCompare(b.relativePath, "zh-CN", { numeric: true });
  return [...groups.values()].sort((a, b) => rank(a) - rank(b)).map((group) => ({ ...group, learning: group.learning.sort(compare), code: group.code.sort(compare) }));
}
