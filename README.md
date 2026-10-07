<div align="center">

<img src="docs/assets/icons/book-open.svg" width="64" height="64" alt="知识库" />

# 梦梦的知识库

**YUME / STAR ARCHIVE**

从学习笔记到代码实践，把值得留下的知识连成一条线。

[在线阅读](https://lihongzy.github.io/knowledge-base/) · [笔记索引](INDEX.md) · [开发文档](site/docs/features.md) · [反馈问题](https://github.com/lihongzy/knowledge-base/issues)

[![Deploy](https://github.com/lihongzy/knowledge-base/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/lihongzy/knowledge-base/actions/workflows/deploy-pages.yml)
[![MIT License](https://img.shields.io/badge/License-MIT-7057D9?style=flat-square)](LICENSE)
![Static Site](https://img.shields.io/badge/Next.js-Static_Export-18181B?style=flat-square&logo=nextdotjs&logoColor=white)

</div>

---

## <img src="docs/assets/icons/book-open.svg" width="24" height="24" alt="" /> 不止于收藏，也记录如何实现

这是一个持续更新的个人知识库，以及读取仓库内容生成的只读展示站点。笔记以 Markdown 保存，代码与资料保留在各自的目录中；网站负责组织、检索与阅读，不取代原始文件。

| 内容入口 | 你可以找到什么 |
| :--- | :--- |
| <img src="docs/assets/icons/git-branch.svg" width="20" height="20" alt="" /> [Git](https://lihongzy.github.io/knowledge-base/topics/git/) | 命令练习、团队协作与回滚经验 |
| <img src="docs/assets/icons/bot.svg" width="20" height="20" alt="" /> [Agent](https://lihongzy.github.io/knowledge-base/topics/agent/) | 按章节组织的学习笔记与配套代码案例 |
| <img src="docs/assets/icons/search.svg" width="20" height="20" alt="" /> [小说爬虫](https://lihongzy.github.io/knowledge-base/topics/novel-scraper/) | 目录解析、章节抓取与语料整理的实现记录 |
| <img src="docs/assets/icons/clapperboard.svg" width="20" height="20" alt="" /> [动漫爬虫](https://lihongzy.github.io/knowledge-base/topics/anime-scraper/) | 视频解析、下载与多线路处理的实践记录 |
| <img src="docs/assets/icons/book-open.svg" width="20" height="20" alt="" /> [小说阅读](https://lihongzy.github.io/knowledge-base/novels/) | 按卷章清单组织的正文与插图阅读入口 |

### 阅读与探索

- <img src="docs/assets/icons/file-code-2.svg" width="18" height="18" alt="" /> **笔记与代码相连** — 本地源码链接进入高亮查看页，支持行号与复制；Agent 同章笔记与案例归组展示。
- <img src="docs/assets/icons/search.svg" width="18" height="18" alt="" /> **搜索无需后端** — `Ctrl / Cmd + K` 检索笔记标题、标签、正文及源码文件名和路径。搜索数据随站点构建，首次使用时在浏览器加载。
- <img src="docs/assets/icons/book-open.svg" width="18" height="18" alt="" /> **适配阅读场景** — 白天与黑夜主题、可收起侧栏、移动端导航、文章目录，以及统一的 Magic UI 星轨视觉。
- <img src="docs/assets/icons/folder-tree.svg" width="18" height="18" alt="" /> **内容仍属于仓库** — YAML 元数据独立展示，笔记保留相对链接；网站静态导出后发布到 GitHub Pages。

## <img src="docs/assets/icons/terminal.svg" width="24" height="24" alt="" /> 在本地打开

使用 **Node.js 24** 与 npm，与当前部署环境保持一致。完整克隆仓库：站点构建会读取 `site/` 之外的笔记与小说目录。

```bash
git clone https://github.com/lihongzy/knowledge-base.git
cd knowledge-base/site
npm ci
npm run dev -- --port 3001
```

访问 **http://localhost:3001**。开发启动前会自动同步笔记与小说资源，不需要手动复制图片。

| 命令（在 `site/` 中执行） | 用途 |
| :--- | :--- |
| `npm run dev -- --port 3001` | 启动开发服务 |
| `npx tsc --noEmit` | 检查 TypeScript 类型 |
| `npm run build` | 构建并静态导出到 `out/` |
| `npm run start` | 预览已经生成的 `out/`，访问终端提示的地址 |

<details>
<summary>验证内容、路由与搜索</summary>

以下命令在 `site/` 目录运行。内容解析检查不需要服务；其余检查需要先在另一个终端启动 `3001` 端口的开发服务。

```powershell
node scripts/check-note-content.mjs
node scripts/check-agent-chapters.mjs
node scripts/check-search.mjs
powershell -File scripts/check-note-routes.ps1
powershell -File scripts/check-source-links.ps1
powershell -File scripts/check-magic-theme.ps1
```

这些是开发回归检查，不会在访客打开网站时执行。`copy-*` 脚本负责资源同步，不能作为缓存清理。

</details>

## <img src="docs/assets/icons/folder-tree.svg" width="24" height="24" alt="" /> 内容源与展示站点

```text
knowledge-base/
├── notes/                 Markdown 笔记及其本地附件
│   ├── 00-inbox/          待整理的快速记录
│   ├── 10-projects/       有明确目标与期限的项目
│   ├── 20-areas/          长期关注的领域
│   ├── 30-resources/      参考资料、工具与学习笔记
│   └── 40-archive/        已结束但保留参考的内容
├── site/                  Next.js 展示站点
├── 小说/                  卷章清单、正文与插图
├── 动漫/                  动漫相关脚本与资料
├── scripts/               笔记创建与索引维护
├── templates/             笔记模板
├── docs/                  项目文档
└── INDEX.md               自动生成的笔记索引
```

网站使用 **Next.js 15 / React 19 / TypeScript**，以 Tailwind CSS、Magic UI 和 shadcn/ui 构建界面；Markdown 由 react-markdown 与 remark-gfm 渲染，Shiki 提供代码高亮，MiniSearch 提供浏览器端检索。

实现细节见 [站点功能文档](site/docs/features.md)，笔记约定见 [Markdown 编写规则](docs/markdown-writing-rules.md)。

### 写一篇笔记

在仓库根目录的 PowerShell 中运行：

```powershell
.\scripts\new-note.ps1 -Path "20-areas/development" -Title "Git conventions"
```

命令使用模板创建笔记，并更新索引。添加 `-Open` 可打开新文件。手动新增、移动或重命名笔记后，运行：

```powershell
.\scripts\update-index.ps1
```

`INDEX.md` 不直接编辑。图片与附件应和笔记放在一起，通过相对路径引用。小说是独立语料，不纳入笔记索引；每部小说使用 `novel.json` 管理卷章，正文位于 `chapters/`。

## <img src="docs/assets/icons/rocket.svg" width="24" height="24" alt="" /> 发布到 GitHub Pages

[部署工作流](.github/workflows/deploy-pages.yml) 在推送到 `master` 时自动执行，也支持在 Actions 中手动触发：

```text
仓库内容 → 安装依赖 → 同步资源与构建 → site/out → GitHub Pages
```

仓库 **Settings → Pages → Source** 选择 **GitHub Actions**。工作流自动设置 `NEXT_PUBLIC_BASE_PATH` 为仓库名对应的路径，当前线上入口是：

**https://lihongzy.github.io/knowledge-base/**

笔记或源码更新后需重新构建发布，线上页面与 `search-index.json` 才会更新。静态文件包含公开内容；发布前需检查笔记、附件与代码中的密钥、Cookie 及个人信息，搜索过滤不能替代发布审核。

## <img src="docs/assets/icons/messages-square.svg" width="24" height="24" alt="" /> 反馈与维护

由 [lihongzy](https://github.com/lihongzy) 维护。发现页面异常、链接失效或笔记错误，请通过 [Issues](https://github.com/lihongzy/knowledge-base/issues) 提供页面地址、复现步骤和必要截图。

提交改动时请说明影响范围；涉及网站行为的修改应同步更新功能文档，并执行相关检查。无需提交 `node_modules/`、`.next/`、`out/` 或自动同步的 `public/*-assets/`。

## <img src="docs/assets/icons/shield-check.svg" width="24" height="24" alt="" /> 开源协议与内容边界

本项目作者拥有版权的原创代码及相关文档采用 [MIT License](LICENSE)，版权归属 **© 2026 lihongzy**。

**MIT 授权不涵盖第三方内容**：小说正文、动漫内容、插图、引用资料、第三方依赖及引入的学习案例，仍遵循各自的版权和许可证；文件内或上游的单独声明适用于对应内容。本仓库的 MIT 协议不授予这些内容的再分发权。

使用抓取工具前，请确认拥有相应授权并遵守目标网站规则。未经授权的第三方内容不应随你的部署公开发布。

README 图标来自 [Lucide](https://lucide.dev/)，以本地 SVG 保存；许可与调整说明见 [图标声明](docs/assets/icons/NOTICE.md)。
