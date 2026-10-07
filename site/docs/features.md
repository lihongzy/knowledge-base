# 知识库站点功能文档

> 本文档描述 `site/` 项目的功能与结构，由 AI 自动维护。当 `site/` 的代码、路由、组件、脚本或配置发生变化时，应同步更新本文档。

## 1. 项目概述

`site/` 是一个**静态站点生成器**：它读取仓库根目录下的 `../notes/` 个人知识库，把其中的 Markdown 笔记与源码文件渲染成可浏览的静态网站，最终以纯静态文件导出。

- **技术栈**：Next.js 15（App Router，`output: "export"` 静态导出）、React 19、TypeScript
- **样式**：Tailwind CSS v4 + Magic UI（MagicCard、FlickeringGrid、BlurFade），统一星夜主题；基础组件共用同一套语义令牌。
- **Markdown 渲染**：react-markdown + remark-gfm
- **代码高亮**：shiki

## 2. 目录结构

```
site/
├── app/                       # Next.js App Router 页面与全局样式
│   ├── layout.tsx             # 根布局：侧边导航、顶部搜索、元数据
│   ├── page.tsx               # 首页：默认展示 Git 主题
│   ├── topics/[topic]/        # Git、Agent、小说爬虫、动漫爬虫主题列表
│   ├── not-found.tsx          # 404 页面
│   ├── globals.css            # Tailwind 入口 + shadcn 主题变量 + 自定义样式
│   ├── notes/[...slug]/       # 笔记路由（分类列表页 + 单篇笔记页）
│   ├── code/[...path]/        # 源码查看路由（仓库根相对路径）
│   └── files/[...path]/       # 外部 Markdown 文档路由（渲染 notes 之外被引用的 .md，如项目 README）
├── components/
│   ├── site-shell.tsx         # 全站侧栏、选中状态、移动端菜单、搜索入口
│   ├── topic-content.tsx      # 主题星轨头图、Magic UI 光效笔记卡片
│   ├── magic-theme.tsx        # 深色主题、MotionConfig、低动态阅读背景
│   ├── reading-outline.tsx    # 宽屏文章目录与当前位置
│   ├── markdown-content.tsx   # Markdown 渲染组件（链接/图片/alert 处理）
│   ├── copy-source-button.tsx # 复制源码按钮（客户端组件）
│   └── ui/                    # shadcn/ui 组件（如 button.tsx）
├── lib/
│   ├── navigation.ts          # 主题名称、路由、笔记目录映射
│   ├── notes.ts               # 笔记数据层：扫描/读取/分类
│   ├── source-files.ts        # 源码文件数据层（按仓库根扫描 notes/动漫/小说）
│   ├── repo-docs.ts           # 外部 Markdown 文档数据层（动漫/小说 下、notes 之外）
│   ├── site.ts                # 路径与 basePath 工具函数
│   └── utils.ts               # shadcn 的 cn 工具（re-export）
├── scripts/
│   └── copy-note-assets.mjs   # 构建前复制笔记资源到 public/note-assets
├── public/note-assets/        # 笔记的图片等资源（构建时生成）
├── components.json            # shadcn/ui 配置
├── postcss.config.mjs         # Tailwind PostCSS 插件配置
├── next.config.ts             # Next.js 配置（静态导出、basePath）
└── package.json
```

## 3. 功能模块

### 3.1 首页与主题列表

- 首页默认显示 Git 主题；`/topics/[topic]/` 静态生成四个主题页面。
- `lib/navigation.ts` 将 Git、Agent、小说爬虫、动漫爬虫分别映射到 `tools/git`、`tools/hello-agents`、`tools/novel-scraper`、`tools/video-scraper`（均位于 `notes/30-resources/` 下）。
- `components/topic-content.tsx` 按目录前缀筛选笔记。Agent 通过 `lib/agent-chapters.ts` 识别文件名和目录中的 `chapterN`，按章节编号自然排序；`components/agent-chapters.tsx` 每章使用一个 MagicCard，内部按「学习笔记 / 代码案例」显示紧凑链接列表。同章标题只在组头显示，列表去除重复章节前缀，文章原始标题与地址不变。代码环境 README 放在最前的「准备工作」，未识别章节的其他资料保留在末尾。Git 和爬虫主题保持原有目录分组及卡片布局。
- `node scripts/check-agent-chapters.mjs` 检查章节排序、同章笔记与案例归组、标题清理、准备工作、条目完整性及开发服务第六章渲染。
- 侧边栏展示 Git、Agent，以及默认展开的「爬虫」分组，底部从 `getNovels()` 自动生成具体小说资源链接。选中主题在笔记页和源码页继续高亮。
- 顶部搜索通过点击或 Ctrl/Cmd+K 打开 Command 面板，搜索笔记标题、标签、正文，以及源码文件名和路径。

### 3.1.1 站内搜索

- `app/search-index.json/route.ts` 使用 `force-static`：生产构建生成静态 JSON，部署不需要搜索后端；开发环境重新请求索引读取当前内容。
- `lib/search-content.ts` 去除 Markdown 标记、代码围栏、外链及凭据字段所在行；源码仅索引文件名和路径，过滤常见凭据文件名，小说章节不纳入。索引是公开文件，发布前仍需审核原始笔记中的敏感内容，自动过滤不是安全审计的替代。
- `getAllSourcePaths()` 只列出源码路径，不读取源码正文；`videos/*.ts` 是媒体，不纳入源码页或搜索。
- `lib/search.ts` 使用 MiniSearch，标题、标签、路径比正文权重更高；中文使用连续双字切分，中英文查询 AND 匹配，英文前缀及谨慎模糊匹配。最多显示 30 个结果。
- `components/site-search.tsx` 首次打开时延迟加载搜索引擎与索引，在当前浏览器页面生命周期内缓存；失败后可重试。内容变更后重新打开页面以刷新浏览器缓存；生产环境需重新构建发布。
- shadcn Command（关闭内置筛选）与 Base UI Dialog 提供分组、键盘选择、焦点管理和 Esc 关闭，使用当前昼夜主题语义令牌；结果按笔记/源码分组，笔记显示匹配摘要，点击或回车跳转。
- 搜索输入的焦点提示由外层 InputGroup 呈现，包住图标与文字；输入框自身不叠加全站矩形 outline，避免与搜索图标重叠。
- 验证：`node scripts/check-search.mjs` 检查中文、中英文、路径前缀、摘要、过滤及本地服务索引；`SEARCH_TEST_URL` 可指定导出的静态索引地址。

### 3.2 笔记页
- 文件：`app/notes/[...slug]/page.tsx`
- 两种模式：
  1. **分类列表页**：当 `slug` 长度为 1 且是已知分类名时，列出该分类下所有笔记。
  2. **单篇笔记页**：其余情况渲染单篇笔记正文，带面包屑导航。
- 使用 `lib/note-content.ts` 和 js-yaml 解析开头的 YAML 元数据，正文不显示 frontmatter。页面头部单独显示标题、更新时间和标签；移除正文开头的一级标题，避免重复。没有元数据时使用正文标题或文件名，隐藏缺失的日期和标签。
- 单篇笔记头部与正文共用最大 820px 的居中容器。Markdown 使用 16px 正文、1.9 行高；二三级标题为 24px/19px。代码块、引用、表格统一深色星夜主题；1440px 以上屏幕显示文章目录。标题生成稳定锚点，支持重复标题后缀。
- 使用 `generateStaticParams()` 预生成所有分类页与笔记页。

### 3.3 Markdown 渲染
- 文件：`components/markdown-content.tsx`
- 能力：
  - 基于 react-markdown + remark-gfm，支持 GFM（表格、删除线、任务列表等）。
  - 自定义 `remarkAlerts` 插件：把 `[!NOTE]`、`[!TIP]`、`[!IMPORTANT]`、`[!WARNING]`、`[!CAUTION]` 引用块转成 `markdown-alert` 样式。
  - 链接与图片先被解析为**仓库根相对路径**（依 `fileBase` prop：笔记页为 `notes` 相对、`/files` 渲染的外部文档为仓库根相对），再按优先级重写：
    1. `#...` 锚点 → 原样保留。
    2. `http(s)` 外链 → 新窗口打开（`target="_blank"`）。
    3. `.md` 链接：落在 `notes/` 下 → 站内笔记页 `/notes/.../`；越出 `notes/`（如 `动漫/.../README.md`）→ `/files/.../`。
    4. 源码文件链接（先解码中文 URL 路径，再由 `isSourceFile` 与 `sourceRoots` 判断）→ `/code/.../`（仓库根相对路径）。
    5. 其他相对路径（图片等资源）→ `/note-assets/...`（或 `assetPrefix` 指定前缀）。
  - 图片 `src` 通过 `resolveAsset` 重写到 `/note-assets/...`（不依赖 `fileBase`，保持小说等既有资源行为）。

### 3.4 源码查看页
- 文件：`app/code/[...path]/page.tsx`
- 功能：
  - 展示 `sourceRoots`（`notes`、`动漫`、`小说`）下的源码文件，路径以**仓库根相对**形式给出（如 `/code/动漫/进击的巨人/downloadVideo.js/`）。
  - 使用 shiki（`github-dark` 主题）做语法高亮，语言由扩展名映射（见 4.3）。
  - 显示文件名、相对路径、行号，支持一键复制源码（复制纯代码文本，不含行号）。
  - 代码块**完全展开**：无纵向高度上限，整页随源码内容自然变长，仅横向滚动（长行不换行）。
  - 工具栏（含「复制源码」按钮）**吸顶**（桌面 `top: 76px`，手机 `top: 64px`，避开全站顶栏），长代码滚动时始终可见。
  - 圆角由源码外框 `overflow: clip` 统一裁切，工具栏使用完整矩形遮挡滚动内容，避免吸顶时圆角露出黑色行号背景；外框不创建滚动容器，保留整页滚动与工具栏吸顶。
  - `generateStaticParams()` 预生成所有源码页。

### 3.5 复制源码按钮
- 文件：`components/copy-source-button.tsx`
- 功能：`"use client"` 客户端组件，调用 `navigator.clipboard.writeText` 复制源码，带「复制源码 / 正在复制… / 已复制 / 复制失败」状态反馈与自动复位。

### 3.6 外部 Markdown 文档页
- 文件：`app/files/[...path]/page.tsx` + `lib/repo-docs.ts`
- 功能：渲染 notes 之外、被笔记相对链接引用的 `.md`（如各项目 `README.md`），在站内以正文排版展示。
  - 数据层扫描 `docRoots`（`动漫`、`小说`）下的 `.md`，排除 `chapters` 目录（小说章节已由 `/novels` 承载）。
  - 用 `MarkdownContent` 并以 `fileBase="repo"` 渲染，使文档内部的相对链接再按仓库根解析。

### 3.7 数据层
- `lib/notes.ts`：扫描 `../notes/` 下的 Markdown，提供 `getAllNotes()`、`getNote()`、`categoryFor()`、`categoryLabel()`。
- `lib/source-files.ts`：按仓库根扫描 `sourceRoots`（`notes`、`动漫`、`小说`）下的源码文件，提供 `getAllSourceFiles()`、`getSourceFile()`、`isSourceFile()`、`isUnderSourceRoot()`；`relativePath` 为仓库根相对路径。
- `lib/repo-docs.ts`：扫描 `docRoots`（`动漫`、`小说`）下、`chapters` 之外的 `.md`，提供 `getAllRepoDocs()`、`getRepoDoc()`、`isUnderDocRoot()`。
- `lib/site.ts`：`pageHref()`、`assetHref()`、`encodePath()`、`siteBasePath`（读取 `NEXT_PUBLIC_BASE_PATH`）。

### 3.8 资源复制脚本
- 文件：`scripts/copy-note-assets.mjs`
- 功能：构建前（`prebuild` / `dev`）把 `../notes/` 下所有**非 Markdown** 文件复制到 `public/note-assets/`，供笔记中的图片与源码附件引用。
- 排除规则：`.env`、`.env.example`，以及 `ignoredDirectories` 中的目录。

### 3.9 根布局与字体
- 文件：`app/layout.tsx`
- 功能：设置站点元数据，通过 `SiteShell` 提供固定侧栏、顶部搜索入口和右侧正文。768px 以下通过菜单按钮展开侧栏，点击链接或遮罩关闭。使用本机无衬线字体，无构建期在线字体下载。

### 3.10 404 页面
- 文件：`app/not-found.tsx`
- 功能：展示「页面不存在」与返回首页链接。

### 3.11 UI 组件库（shadcn/ui）
- 配置：`components.json`（style `base-nova`，baseColor `neutral`，图标库 `lucide`）。
- 组件统一生成到 `components/ui/`，用 Tailwind 工具类与 shadcn 主题变量。

## 4. 关键常量与映射

### 4.1 忽略目录
`lib/notes.ts` 与 `scripts/copy-note-assets.mjs` 忽略的目录：

```
.venv, node_modules, __pycache__, .git
```

`lib/source-files.ts` 与 `lib/repo-docs.ts`（按仓库根扫描）额外忽略构建产物目录：

```
.venv, node_modules, __pycache__, .git, .next, out, dist
```

`lib/repo-docs.ts` 还排除 `chapters` 目录（小说章节已由 `/novels` 承载，不在 `/files` 重复渲染）。

### 4.2 分类映射
`lib/notes.ts` 中的 `categoryNames`：

| 一级目录 | 显示名称 |
| --- | --- |
| `00-inbox` | 收件箱 |
| `10-projects` | 项目 |
| `20-areas` | 领域 |
| `30-resources` | 资源 |
| `40-archive` | 归档 |

### 4.3 内容根、源码扩展名与语言映射
`lib/source-files.ts` 中 `sourceRoots`（`/code` 静态纳入的内容根，相对仓库根）：

```
notes, 动漫, 小说
```

`lib/repo-docs.ts` 中 `docRoots`（`/files` 渲染的 Markdown 内容根，notes 由 `/notes` 承载）：

```
动漫, 小说
```

`lib/source-files.ts` 中 `sourceExtensions`（判定为源码文件的扩展名，不再要求在 `code` 目录内）：

```
.py .js .jsx .ts .tsx .json .sh .ps1
```

`app/code/[...path]/page.tsx` 中的高亮语言映射：

| 扩展名 | shiki 语言 |
| --- | --- |
| js | javascript |
| jsx | jsx |
| json | json |
| ps1 | powershell |
| py | python |
| sh | bash |
| ts | typescript |
| tsx | tsx |
| 其他 | text |

### 4.4 构建与环境变量
- `next.config.ts`：生产构建使用 `output: "export"`（静态导出），开发服务器关闭该模式，避免 Next.js 15 对中文 URL 与静态参数进行编码不一致的匹配；保留 `trailingSlash: true`、`images.unoptimized`。
- `NEXT_PUBLIC_BASE_PATH`：可选，用于设置部署子路径（basePath）。

## 5. 设计令牌与样式架构

全站采用单一「星夜书库」设计系统，Magic UI 和基础组件共用语义令牌，没有独立的第二套配色。

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--background` | `#0b0e1c` | 星夜背景 |
| `--foreground` | `#ecedfa` | 标题与主文字 |
| `--primary` | `#b29bff` | 紫色强调、导航选中 |
| `--pine` | `#91d7f2` | 冰蓝链接 |
| `--card` | `#111629` | 卡片与目录 |
| `--muted-foreground` | `#939bb7` | 辅助文字 |
| `--code` | `#0c1120` | 源码与代码块 |

既有 `ink/paper/brand/line` 别名映射到以上令牌，保证所有旧路由同步换肤。字体使用本地 Bahnschrift、微软雅黑和 Cascadia Code，不依赖字体网络请求。

- 真实注册表组件：`components/ui/magic-card.tsx`（鼠标跟随光效）、`flickering-grid.tsx`（稀疏星点）、`blur-fade.tsx`（主题区淡入）。
- `magic-theme.tsx` 默认白天主题，按钮图标与文字显示当前主题（白天/黑夜），提示与无障碍标签说明切换目标；顶部昼夜切换通过 next-themes 保存到 `yume-theme`，刷新和跨页保持用户选择；MotionConfig 尊重系统减少动态效果偏好，阅读路由降低背景强度。
- 白天与黑夜共用布局和语义令牌；白天以纯白页面、白色侧栏和卡片为主，移除全屏蓝紫渐变，星点减弱，少量紫色仅用于强调。正文、标签、卡片、目录及工具栏均适配。源码编辑区保持高对比深色高亮。
- 导航及操作图标统一使用现有 `lucide-react` SVG：品牌书架、Git 分支、Agent 机器人、小说书本、动漫场记板，以及卡片入口箭头；搜索、昼夜与侧栏按钮也使用同套图标，不依赖字符字体显示。星轨装饰保留。
- 顶部左侧按钮可收起/展开桌面侧栏，收起后正文利用释放的空间；手机端仍采用独立抽屉状态，桌面收起不会影响手机导航。
- 装饰网格只在 hydration 后挂载，避免系统减少动态效果设置造成服务端/客户端渲染不一致。CSS 星轨仅用于主题展示区；正文不滚动、不翻转、不逐字动画。
- 主题卡片保留分类和排序；小说书架与详情复用本地首章插图作为封面，无插图时展示星形占位。
- Markdown、源码工具栏、目录抽屉、404 和所有业务页面使用相同背景、边框、圆角及链接色。
- 手机端提供侧栏菜单和 Escape 关闭；全站提供跳转正文入口。减少动态效果时停用星点和轨道动画；无 JavaScript 时淡入内容保持可见。
- 小说嵌套布局继承根布局，不再次输出 html/body，避免主题和 hydration 冲突。

## 6. 维护说明

- 回归检查：`scripts/check-magic-theme.ps1` 验证共享主题、单一 HTML 外壳和单一标题；配合中文笔记路由、源码链接与元数据解析检查。
- 源码扫描已排除 `videos/*.ts` 媒体。开发服务可设置 `NEXT_DEV_DIR` 使用独立缓存，生产静态导出使用默认 `out/`。

- 新增/移动/删除笔记后无需改动代码，站点会自动重新扫描。
- 新增页面或路由时，同步更新「目录结构」与「功能模块」两节。
- 修改常量、映射或排除规则时，同步更新「关键常量与映射」一节。
- 修改自定义样式变量时，同步更新「设计令牌与样式架构」一节。
- 新增样式必须使用统一的语义令牌；Magic UI 动效按场景组合，阅读区域保持稳定。
