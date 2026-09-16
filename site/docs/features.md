# 知识库站点功能文档

> 本文档描述 `site/` 项目的功能与结构，由 AI 自动维护。当 `site/` 的代码、路由、组件、脚本或配置发生变化时，应同步更新本文档。

## 1. 项目概述

`site/` 是一个**静态站点生成器**：它读取仓库根目录下的 `../notes/` 个人知识库，把其中的 Markdown 笔记与源码文件渲染成可浏览的静态网站，最终以纯静态文件导出。

- **技术栈**：Next.js 15（App Router，`output: "export"` 静态导出）、React 19、TypeScript
- **样式**：Tailwind CSS v4 + shadcn/ui（`base-nova` 风格），并叠加了一套自定义的「纸感 + 松绿」排版样式
- **Markdown 渲染**：react-markdown + remark-gfm
- **代码高亮**：shiki

## 2. 目录结构

```
site/
├── app/                       # Next.js App Router 页面与全局样式
│   ├── layout.tsx             # 根布局：全局 header/footer、字体、元数据
│   ├── page.tsx               # 首页：笔记分类展示
│   ├── not-found.tsx          # 404 页面
│   ├── globals.css            # Tailwind 入口 + shadcn 主题变量 + 自定义样式
│   ├── notes/[...slug]/       # 笔记路由（分类列表页 + 单篇笔记页）
│   └── code/[...path]/        # 源码查看路由
├── components/
│   ├── markdown-content.tsx   # Markdown 渲染组件（链接/图片/alert 处理）
│   ├── copy-source-button.tsx # 复制源码按钮（客户端组件）
│   └── ui/                    # shadcn/ui 组件（如 button.tsx）
├── lib/
│   ├── notes.ts               # 笔记数据层：扫描/读取/分类
│   ├── source-files.ts        # 源码文件数据层
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

### 3.1 首页（笔记分类展示）
- 文件：`app/page.tsx`
- 功能：
  - 调用 `getAllNotes()` 扫描 `../notes/` 下所有 `.md` 文件。
  - 按一级目录（分类）分组展示，分类名通过 `categoryLabel()` 映射为中文（见 4.2）。
  - 每个分类下再按笔记所在的二级目录分组列出笔记链接。

### 3.2 笔记页
- 文件：`app/notes/[...slug]/page.tsx`
- 两种模式：
  1. **分类列表页**：当 `slug` 长度为 1 且是已知分类名时，列出该分类下所有笔记。
  2. **单篇笔记页**：其余情况渲染单篇笔记正文，带面包屑导航。
- 使用 `generateStaticParams()` 预生成所有分类页与笔记页。

### 3.3 Markdown 渲染
- 文件：`components/markdown-content.tsx`
- 能力：
  - 基于 react-markdown + remark-gfm，支持 GFM（表格、删除线、任务列表等）。
  - 自定义 `remarkAlerts` 插件：把 `[!NOTE]`、`[!TIP]`、`[!IMPORTANT]`、`[!WARNING]`、`[!CAUTION]` 引用块转成 `markdown-alert` 样式。
  - 链接重写（按优先级）：
    1. `.md` 链接 → 站内笔记页 `/notes/.../`。
    2. `http(s)` 外链 → 新窗口打开（`target="_blank"`）。
    3. 源码文件链接（`isSourceFile` 命中）→ `/code/.../`。
    4. 其他相对路径（图片等资源）→ `/note-assets/...`。
    5. 锚点链接 `#...` 原样保留。
  - 图片 `src` 通过 `resolveAsset` 重写到 `/note-assets/...`。

### 3.4 源码查看页
- 文件：`app/code/[...path]/page.tsx`
- 功能：
  - 展示 `../notes/` 中 `code` 目录下的源码文件。
  - 使用 shiki（`github-dark` 主题）做语法高亮，语言由扩展名映射（见 4.3）。
  - 显示文件名、相对路径、行号，支持一键复制源码（复制纯代码文本，不含行号）。
  - 代码块**完全展开**：无纵向高度上限，整页随源码内容自然变长，仅横向滚动（长行不换行）。
  - 工具栏（含「复制源码」按钮）**吸顶**（`sticky top-0`），长代码滚动时始终可见。
  - `generateStaticParams()` 预生成所有源码页。

### 3.5 复制源码按钮
- 文件：`components/copy-source-button.tsx`
- 功能：`"use client"` 客户端组件，调用 `navigator.clipboard.writeText` 复制源码，带「复制源码 / 正在复制… / 已复制 / 复制失败」状态反馈与自动复位。

### 3.6 数据层
- `lib/notes.ts`：扫描 `../notes/` 下的 Markdown，提供 `getAllNotes()`、`getNote()`、`categoryFor()`、`categoryLabel()`。
- `lib/source-files.ts`：扫描源码文件，提供 `getAllSourceFiles()`、`getSourceFile()`、`isSourceFile()`。
- `lib/site.ts`：`pageHref()`、`assetHref()`、`encodePath()`、`siteBasePath`（读取 `NEXT_PUBLIC_BASE_PATH`）。

### 3.7 资源复制脚本
- 文件：`scripts/copy-note-assets.mjs`
- 功能：构建前（`prebuild` / `dev`）把 `../notes/` 下所有**非 Markdown** 文件复制到 `public/note-assets/`，供笔记中的图片与源码附件引用。
- 排除规则：`.env`、`.env.example`，以及 `ignoredDirectories` 中的目录。

### 3.8 根布局与字体
- 文件：`app/layout.tsx`
- 功能：全局 `<header>`（站点词标 + 副标题）与 `<footer>`；设置站点元数据；通过 `next/font/google` 引入 Geist 字体并挂载为 `--font-sans`。

### 3.9 404 页面
- 文件：`app/not-found.tsx`
- 功能：展示「页面不存在」与返回首页链接。

### 3.10 UI 组件库（shadcn/ui）
- 配置：`components.json`（style `base-nova`，baseColor `neutral`，图标库 `lucide`）。
- 组件统一生成到 `components/ui/`，用 Tailwind 工具类与 shadcn 主题变量。

## 4. 关键常量与映射

### 4.1 忽略目录
`lib/notes.ts` 与 `lib/source-files.ts`、`scripts/copy-note-assets.mjs` 中共享的忽略目录：

```
.venv, node_modules, __pycache__, .git
```

### 4.2 分类映射
`lib/notes.ts` 中的 `categoryNames`：

| 一级目录 | 显示名称 |
| --- | --- |
| `00-inbox` | 收件箱 |
| `10-projects` | 项目 |
| `20-areas` | 领域 |
| `30-resources` | 资源 |
| `40-archive` | 归档 |

### 4.3 源码扩展名与语言映射
`lib/source-files.ts` 中 `sourceExtensions`（判定为源码文件的扩展名）：

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
- `next.config.ts`：`output: "export"`（静态导出）、`trailingSlash: true`、`images.unoptimized`。
- `NEXT_PUBLIC_BASE_PATH`：可选，用于设置部署子路径（basePath）。

## 5. 设计令牌与样式架构

`app/globals.css` 中保留了自定义「纸感」设计的 CSS 变量（为避免与 shadcn 主题变量冲突，已重命名两个）：

| 变量 | 值 | 用途 |
| --- | --- | --- |
| `--ink` | `#1c2824` | 主文字色 |
| `--pine` | `#1f5147` | 松绿（链接、强调） |
| `--paper` | `#f5f0e5` | 纸张底色 |
| `--paper-deep` | `#ebe4d4` | 深纸张色（代码行内背景） |
| `--line` | `#c9c0ad` | 分隔线 |
| `--ink-muted` | `#6e7468` | 次要文字（原 `--muted`） |
| `--code` | `#152720` | 代码块背景 |
| `--brand` | `#d9633b` | 品牌橙（原 `--accent`） |

这些 token 同时通过 `@theme inline` 注册为 Tailwind 颜色/字体工具类，可生成 `text-ink`、`text-brand`、`text-ink-muted`、`bg-paper`、`bg-code`、`border-line`、`font-mono`、`font-serif` 等 utility。

**样式架构（混合）**：

- 简单布局、颜色、字体、间距 → 直接在各页面 JSX 中用 Tailwind utility（如 `text-brand`、`font-mono`、`border-line`）。
- 复杂规则保留手写 CSS：`.prose`（react-markdown 生成的正文排版）、`.source-code`/`.source-line`/`.line-number`/`.line-content`（代码高亮的精细布局与 sticky 行号）、`.copy-source-button`（多状态按钮）、`body` 的纸纹渐变背景。

> 注意：自定义样式与 shadcn 组件是两套独立的设计体系，互不干扰。若要让 shadcn 组件也贴合这套配色，需调整 `:root` 中 shadcn 的 `--primary`、`--accent` 等变量。

## 6. 维护说明

- 新增/移动/删除笔记后无需改动代码，站点会自动重新扫描。
- 新增页面或路由时，同步更新「目录结构」与「功能模块」两节。
- 修改常量、映射或排除规则时，同步更新「关键常量与映射」一节。
- 修改自定义样式变量时，同步更新「设计令牌与样式架构」一节。
- 新增样式时遵循混合约定：简单布局/颜色/字体用 Tailwind utility，复杂排版与多状态组件保留手写 CSS。
