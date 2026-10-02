# Collaboration Instructions

## Agent skills

### Issue tracker

Issues live as Markdown under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the default five canonical triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

Uses a single-context layout. See `docs/agents/domain.md`.

## Knowledge base layout

个人知识笔记存放在 `notes/` 下，分类如下：

- `notes/00-inbox/`：等待整理的快速记录。
- `notes/10-projects/`：有明确目标和期限的项目工作。
- `notes/20-areas/`：持续负责的事务和长期关注的领域。
- `notes/30-resources/`：参考资料、概念、工具和学习笔记。
- `notes/40-archive/`：已结束或不再活跃、但需要保留参考的内容。

需要进一步分类时，在对应类别下创建主题文件夹。Markdown 笔记应与本地图片或附件保存在一起，确保相对链接有效。例如，Git 参考资料应放在 `notes/30-resources/tools/git/`。

新增、移动或重命名笔记后，运行 `scripts/update-index.ps1` 更新索引。不要直接编辑自动生成的 `INDEX.md`。

Markdown 笔记编写规则见 `docs/markdown-writing-rules.md`。

## Novel corpus

小说语料存放在仓库根目录 `小说/` 下，与 `notes/` 平级。每部小说一个子目录（如 `小说/游戏人生/`），内含 `novel.json` 卷章清单和 `chapters/` Markdown 正文，插图与正文保存在同一目录（`chapters/images/`）。

小说不是笔记：不纳入 `scripts/update-index.ps1` 生成的 `INDEX.md`，而是由展示站点的 `/novels` 路由直接读取 `小说/` 下的数据渲染。

## Temporary artifacts

AI 生成的临时文件和中间产物统一存放在 `temp/`。
