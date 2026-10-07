---
title: "linovelib 小说爬虫"
created: "2026-10-02"
updated: "2026-10-02"
tags: [爬虫, nodejs, linovelib, 小说]
---

# linovelib 小说爬虫

## Summary

针对轻之文库（linovelib.com）的小说抓取脚本：按"解析目录 → 生成卷/章清单 → 逐章抓正文与插图"三阶段，把整本小说抓成 Markdown 语料，并生成 `novel.json` 清单。实战成果：《游戏人生》16 卷 130 章、正文 1,776,396 字（与源站"177.6 万字"口径一字不差），图文位置与原文一致。

源码：[小说/游戏人生/scratch.js](../../../../小说/游戏人生/scratch.js)
技术栈：Node.js + axios（HTTP）+ cheerio（DOM 解析），依赖见脚本同目录 `package.json`。

## Notes

### 一、总体设计

脚本是一条**三阶段流水线**，拆阶段的收益是可以分开跑：

1. **目录阶段**（`fetchCatalog`）：只请求一次目录页，拿到"卷 → 章"结构与每章 URL，秒级完成。
2. **清单阶段**（`resolveLockedChapters` + `writeManifest`）：补齐目录里拿不到链接的"锁定章节"，给每章分配全局序号并写 `novel.json`。
3. **正文阶段**（`fetchChapter`）：逐章跟分页抓正文、下插图，写 `chapters/{序号}-{标题}.md`。这是最慢、最容易被反爬打断的阶段。

拆开后每一步都可重跑且**幂等**：目录和清单随便刷；正文抓一半中断，重跑 `missing` 就只补空缺章，已完成的章不动。

```text
目录页 catalog ──fetchCatalog──> volumes（卷→章 + URL，锁定章 url 为 null）
                     │              └─resolveLockedChapters─> 补齐锁定章 URL
                     ▼
                writeManifest ──> novel.json（全局序号 / slug / 文件名）
                     ▼
                fetchChapter ×N ──> chapters/*.md + chapters/images/*.jpg
```

### 二、运行环境与命令

脚本放在 `小说/<书名>/` 目录下运行（`NOVEL_ID` 自动取所在文件夹名），产出全部落在原地：

```text
小说/游戏人生/
├── scratch.js          # 本脚本
├── package.json        # axios + cheerio
├── novel.json          # 清单（脚本生成）
└── chapters/
    ├── 001-插图.md …   # 每章一个 Markdown
    └── images/         # 插图（{章节base id}_{章内序号}.jpg）
```

| 命令 | 作用 | 网络开销 |
| --- | --- | --- |
| `node scratch.js manifest` | 只解析目录 + 解析锁定章 + 刷新 `novel.json` | 1 次目录 + 锁定章反查（每章数次翻页） |
| `node scratch.js missing` | 只补抓本地不存在的章节文件 | 按缺口计 |
| `node scratch.js [起始序号] [章数]` | 从全局序号起抓正文（默认第 1 章、全部） | 每章 1~50 页 |

章与章之间固定间隔 `REQUEST_DELAY = 800ms`，避免触发 Cloudflare 限流。

### 三、模块详解

#### 3.1 请求层：HEADERS 与 getRequest

- `HEADERS` 是从浏览器 DevTools 整段复制的请求头，核心是 Cloudflare 的 `cf_clearance` cookie。**`cf_clearance` 与签发时的 `user-agent` 和出口 IP 三者绑定**，任何一项不一致都不报 403，而是请求挂起直到 20 秒超时（见"坑"一节）。
- `getRequest(url, options, retries)` 统一收口所有 GET：
  - **无响应**（网络错误、超时）或 **5xx / 429** → 退避重试（`1s × 次数`，最多 3 次）；
  - **其他 4xx** → 直接抛出，不浪费重试；
  - 图片下载传 `responseType: "arraybuffer"` 复用同一入口。

#### 3.2 目录解析：fetchCatalog

目录页 DOM 结构固定：每卷一个 `.volume` 区块，卷标题在 `.volume-info h2 a`，章节列表在 `.chapter-list li a`。

对每个 `<a>`：

- 正常条目：`href` 是 `/novel/9/2082.html` 这类相对路径，拼上 `BASE_URL` 存为 `url`。
- **锁定条目**：`href="javascript:cid(0)"`（不是以 `/` 开头）。这类章节**并非付费内容**，只是站点故意不把真实链接放在目录里。脚本不丢弃，而是存成 `{ title, url: null, locked: true }` 占位，保住它在卷内的位置——后续序号分配依赖目录原始顺序。

#### 3.3 章节 id 与锁定章节反查

`chapterBaseId(url)` 用正则 `/\/(\d+)(?:_\d+)?\.html/` 从 URL 提取章节基础 id：`/novel/9/2082_2.html` → `2082`。`_N` 后缀是同一章的分页，**base id 不变**——这是判断"下一页还在本章"还是"翻进了下一章"的唯一依据。

锁定章节的真实地址藏在**上一章末页**的页脚导航里：

- `findNextChapterUrl(prevUrl)`：从上一章首页进入，循环看 `.mlfy_page` 里文本含"下一页"的链接——base id 与上一章相同就继续翻（同章分页），不同就说明到了末页、该链接指向下一章，返回它。带 50 页保险丝防死循环。
- `resolveLockedChapters(volumes)`：把所有卷展平成一维阅读顺序，逐条处理 `locked` 占位，拿**前一条的 url** 反查。因为反查成功后会写回 `ch.url`，**连续多个锁定章也能链式解析**（第 2 个锁定章用刚解析出的第 1 个的 url 当前一章）。首章无法反查（没有"上一章"），实际书中首章也不会锁定。
- 实测《游戏人生》共 5 个锁定章，全部解析成功：2061、2083、2105、2127、184725（分别对应卷三"第四章 收束法"、卷六"第一章 3？=无望"、卷七"后记"、外传"高牌全押【前篇】"、卷十二"前奏曲"）。

#### 3.4 清单生成：decorateVolumes 与 writeManifest

`decorateVolumes` 按卷顺序给每章分配**全局序号** `seq`（从 1），并派生三样东西（清单和写盘共用同一函数，保证两边永不打架）：

- `slug`：`String(seq).padStart(3, "0")` → `"001"`、`"044"`…（必须纯 ASCII，理由见"坑"）
- `file`：`{slug}-{safeName(标题)}.md`，`safeName` 剥掉 `\ / : * ? " < > |` 等 Windows 非法字符
- `url`：解析后的章节地址（可能为 `null`，抓取时跳过并警告）

`writeManifest` 把结果包上 `id`（文件夹名）、`slug`（书的 ASCII 标识）、`title`、`sourceCatalog` 写成 `novel.json`：

```json
{
  "id": "游戏人生",
  "slug": "no-game-no-life",
  "title": "游戏人生 NO GAME NO LIFE",
  "sourceCatalog": "https://www.linovelib.com/novel/9/catalog",
  "volumes": [
    {
      "title": "游戏人生 NO GAME NO LIFE 1 听说游戏玩家兄妹要征服幻想世界",
      "chapters": [
        { "seq": 1, "slug": "001", "title": "插图", "file": "001-插图.md", "url": "https://www.linovelib.com/novel/9/118061.html" }
      ]
    }
  ]
}
```

主流程每次抓正文前都会先刷新清单，所以 `novel.json` 始终与磁盘文件名同步。

#### 3.5 正文抓取：fetchChapter + walkContent

`fetchChapter` 负责**翻页循环**：从章节第一页起，每页调 `walkContent` 抽取内容，然后在 `.mlfy_page` 中找 base id 不变的"下一页"；找不到（翻到本章末页）即结束。返回拼好的 Markdown 与图片数。每页有 50 页保险丝。

`walkContent` 按 `#TextContent` 的 **DOM 顺序**遍历子节点，这是"图文位置与原文一致"的关键——不是先收全部文字再补图片，而是遇到什么处理什么：

| 节点 | 处理 |
| --- | --- |
| `<script>` / `<style>` / `.dag`（广告）/ `#show-more-images` | 跳过（噪音） |
| `<img>` 或容器内嵌套 `<img>` | 逐张下载，原位插入 `![插图 n](images/…)`；占位图（无真实 src）跳过 |
| `<p>` | 压空白后作为段落 |
| `<center>` | 插 `---` 分隔线 + 居中文字（卷末"×完××"类排版标记） |
| `<br>` | 忽略（段落之间本来就有空行） |
| 其他元素 / 裸文本节点 | 取 text 作段落 |

每章 Markdown 的头部固定是标题 + 来源行，便于回溯：

```markdown
# 第一章 3？=无望

> 来源：https://www.linovelib.com/novel/9/2083.html
```

#### 3.6 插图下载：realImgSrc 与 downloadImage

- 站点图片**懒加载**：`src` 是占位小图，真实地址在 `data-src`。`realImgSrc` 按 `data-src → data-original → src` 顺序取第一个 http(s) 链接，取不到就当占位图跳过。
- 文件命名 `{章节base id}_{章内序号}.jpg`（如 `2083_1.jpg`）。用 base id 而不是全局序号，**清单序号怎么重排都不用重抓图**。
- 返回给 Markdown 的路径是相对 `chapters/` 的 POSIX 风格（`images/2083_1.jpg`），保证笔记在本地、GitHub、站点渲染三处都能显示。

### 四、实战踩坑记录

按"现象 → 根因 → 解法"整理，都是这本 130 章的书实打实踩出来的：

- **锁定章节被当成付费章丢弃**。现象：目录明明 130 条，本地只有 125 章。根因：5 个 `href="javascript:cid(0)"` 条目被旧版脚本直接跳过。解法：保留占位 + 从上一章末页反查（3.3 节）。**目录里的 `javascript:` 链接 ≠ 内容不可访问**。
- **cf_clearance 失效的症状不是 403 而是挂起**。现象：某几个页面上直接 fetch 能开、脚本里 axios 请求 20 秒超时；换别的 URL 又正常。根因：cookie 与 UA/IP 绑定，过期或 UA 不匹配时 Cloudflare 静默丢弃响应。解法：从浏览器"复制为 cURL"整段头替换，**连同 `user-agent` 一起换**，别只换 cookie。
- **站点"共 146 章"统计不可信**。现象：作品页标 146 章，目录只有 130 条，疑似缺 16 章。验证：本地正文总字数 1,776,396 与站点"177.6 万字"一字不差；末章末页导航只有"目录/返回书页"没有"下一页"。结论：146 − 130 = 16 恰为卷数，**站点把卷标题也计进了章节数**。完整性判断以"目录条目数 + 全文字数比对 + 末章无下一章"三证为准。
- **往清单里插章会引发全局序号位移**。现象：解析出 5 个锁定章后，它们插进卷序，后面全部章节的 `seq` 和文件名都变了，104 个存量文件与清单对不上。解法：以**章节 URL 为键**建立新旧 `novel.json` 的文件映射，一次性批量重命名存量文件，再跑 `missing` 只补 5 个新章。教训：`seq` 是易变坐标，图片名才用不变的 base id。
- **动态段必须 ASCII**。站点用 Next.js `output: export`，dev 服务器对中文动态段的 URL 解码与 build 不一致，导致 `generateStaticParams()` 匹配不上直接 500。所以章节 URL 段用 `001`~`130` 数字 slug，书名 slug 用英文（`no-game-no-life`）。
- **PowerShell 里跑 `node -e "…"` 传中文/引号极易被外壳撕碎**。写诊断小工具一律存成 `.js` 文件再 `node xxx.js`，别内联。

### 五、换一本书抓的改动清单

脚本目前是《游戏人生》专用版，迁移时只需动文件头部几处常量：

1. 把 `scratch.js` 和 `package.json` 复制到新的 `小说/<新书名>/` 目录，`npm install`。
2. 改 `CATALOG_URL` 为新书目录页（`/novel/<id>/catalog`）。
3. 改 `NOVEL_TITLE`（书名）与 `NOVEL_SLUG`（英文标识，用于 URL）。
4. 改 `HEADERS.referer` 为新书主页地址，并从浏览器重新复制一套 `cookie`（含新鲜 `cf_clearance`）和一致的 `user-agent`。
5. 依次跑 `manifest` 核对卷/章数 → 全量抓取 → 用字数比对做完整性校验。

### 六、排错速查

| 症状 | 大概率原因 | 处理 |
| --- | --- | --- |
| 请求超时挂起（非 403） | cookie 过期 / UA 不一致 | 整段重拷浏览器请求头 |
| 本地章数 < 目录条数 | 锁定章未解析 / 抓中断 | `manifest` 看解析日志，再 `missing` |
| 文件名与清单对不上 | 序号位移 | 按 URL 映射批量重命名，勿手改 |
| 图片是占位小图 | 只取了 `src` | 走 `realImgSrc` 的候选属性顺序 |
| 站点章节页 500 | 动态段非 ASCII | 章节用序号 slug |

## References

- 脚本源码：[小说/游戏人生/scratch.js](../../../../小说/游戏人生/scratch.js)
- 实标语料：[小说/游戏人生](../../../../小说/游戏人生)
- 源站目录：<https://www.linovelib.com/novel/9/catalog>
