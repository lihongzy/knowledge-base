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
