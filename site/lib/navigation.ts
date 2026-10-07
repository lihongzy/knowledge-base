export const topics = [
  { slug: "git", label: "Git", prefix: "30-resources/tools/git", description: "版本控制、团队协作与命令练习。" },
  { slug: "agent", label: "Agent", prefix: "30-resources/tools/hello-agents", description: "智能体学习笔记与代码示例。" },
  { slug: "novel-scraper", label: "小说爬虫", prefix: "30-resources/tools/novel-scraper", description: "小说抓取、章节处理与资源整理。" },
  { slug: "anime-scraper", label: "动漫爬虫", prefix: "30-resources/tools/video-scraper", description: "动漫视频下载与多线路处理。" },
];
export type Topic = (typeof topics)[number];
