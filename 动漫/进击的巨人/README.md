# 进击的巨人 · 视频解析下载脚本

从 dm84.tv 解析《进击的巨人》各季 / 剧场版的视频下载地址，并下载保存。

分两步：**先解析（scratch.js）生成 `players.json`，再下载（downloadVideo.js）**。

## 环境准备

在本目录（`动漫/进击的巨人`）下执行：

```powershell
npm install
```

## 第 1 步：解析下载地址（scratch.js）

抓取每一集的播放页，提取真实播放器地址，结果写入 `players.json`。**这一步不下载视频，只解析。**

```powershell
node scratch.js                # 默认：解析全部条目（18 个）
node scratch.js main           # 只解析日配主线六季
node scratch.js cn             # 只解析国语版四季
node scratch.js extra          # 只解析剧场版 / OAD / 外传 / 衍生
node scratch.js s1 s3 finale   # 只解析指定条目（按 key，可多个）
```

> 每次运行会**覆盖** `players.json`。建议直接 `node scratch.js` 一次解析全部，之后再用 downloadVideo.js 挑选要下的季。

## 第 2 步：下载视频（downloadVideo.js）

读取 `players.json`，逐集解析真实直链并下载。文件按季分目录保存：`videos/<季名>/01-标题.mp4`。

参数可以是**组名**（`main`/`cn`/`extra`/`all`），也可以是**条目 key**（见下方对照表），可在同一行混用多个。不带参数则下载 `players.json` 里的全部；参数若全部无效则不会下载任何内容。

**整组下载**

```powershell
node downloadVideo.js main        # 日配主线：s1 s2 s3 s4 final2 finale
node downloadVideo.js cn          # 国语版：cn1 cn2 cn3 cn4
node downloadVideo.js extra       # 剧场版/OAD/外传/衍生：movie1 movie2 movie3 chronicle oad sidestory lostgirls junior
node downloadVideo.js all         # 全部 18 个条目
node downloadVideo.js             # 不带参数：players.json 里的全部
```

**按单条 key 下载**

```powershell
node downloadVideo.js s1          # 第一季
node downloadVideo.js s2          # 第二季
node downloadVideo.js s3          # 第三季
node downloadVideo.js s4          # 第四季
node downloadVideo.js final2      # 最终季 Part.2
node downloadVideo.js finale      # 最终季 完结篇
node downloadVideo.js cn1         # 第一季 国语版
node downloadVideo.js cn2         # 第二季 国语版
node downloadVideo.js cn3         # 第三季 国语版
node downloadVideo.js cn4         # 第四季 国语版
node downloadVideo.js movie1      # 剧场版·红莲之箭
node downloadVideo.js movie2      # 剧场版·自由之翼
node downloadVideo.js movie3      # 剧场版·觉醒的咆哮
node downloadVideo.js chronicle   # 编年史
node downloadVideo.js oad         # OAD
node downloadVideo.js sidestory   # 外传·无悔的选择
node downloadVideo.js lostgirls   # LOST GIRLS
node downloadVideo.js junior      # 进击！巨人中学
```

**组合下载（一行内多个 key/组混用）**

```powershell
node downloadVideo.js s1 s2 s3 s4                 # 主线前四季
node downloadVideo.js main extra                  # 主线六季 + 剧场版/衍生
node downloadVideo.js cn1 cn2                     # 一、二季国语版
node downloadVideo.js movie1 movie2 movie3        # 三部剧场版
node downloadVideo.js final2 finale               # 最终季 Part.2 + 完结篇
```

脚本特性：
- **断点续跑**：已完整下载的集会跳过，不重复下载。
- **完整性校验**：先写 `.part` 临时文件，字节数校验通过后才重命名为 `.mp4`。
- **失败重试**：遇 TLS 断连 / 代理超时等瞬时网络错误，每集最多重试 3 次（指数退避）。

## 条目 key 对照表

| key | 名称 | 详情页 | 分组 |
| --- | --- | --- | --- |
| `s1` | 第一季 | /v/72.html | main |
| `s2` | 第二季 | /v/73.html | main |
| `s3` | 第三季 | /v/74.html | main |
| `s4` | 第四季 | /v/75.html | main |
| `final2` | 最终季 Part.2 | /v/1397.html | main |
| `finale` | 最终季 完结篇 | /v/3811.html | main |
| `cn1` | 第一季国语版 | /v/3081.html | cn |
| `cn2` | 第二季国语版 | /v/3082.html | cn |
| `cn3` | 第三季国语版 | /v/3083.html | cn |
| `cn4` | 第四季国语版 | /v/3084.html | cn |
| `movie1` | 剧场版·红莲之箭 | /v/2189.html | extra |
| `movie2` | 剧场版·自由之翼 | /v/2188.html | extra |
| `movie3` | 剧场版·觉醒的咆哮 | /v/2185.html | extra |
| `chronicle` | 编年史 | /v/2190.html | extra |
| `oad` | OAD | /v/2187.html | extra |
| `sidestory` | 外传·无悔的选择 | /v/2184.html | extra |
| `lostgirls` | LOST GIRLS | /v/2186.html | extra |
| `junior` | 进击！巨人中学 | /v/1170.html | extra |

> `main` / `cn` / `extra` 也可直接当作参数传入，代表整组。

## 文件说明

| 文件 | 作用 |
| --- | --- |
| `scratch.js` | 解析各集播放页，生成 `players.json` |
| `downloadVideo.js` | 读取 `players.json` 解析直链并下载 |
| `catalog.js` | 条目清单与分组（scratch.js / downloadVideo.js 共用） |
| `players.json` | 解析结果（每集的页面、iframe、播放器 token） |
| `videos/` | 下载得到的 `.mp4`，按季分目录 |

## 注意事项

- 脚本默认使用站点**线路 1**（`hhjx` 播放器），只有该线路可被本脚本解析下载。
- 解析出的 `om.tc.qq.com` 直链有时效，下载脚本采用「解析后立即下载」，无需手动处理。
- 若个别集持续失败，多为代理 / 网络链路不稳，可更换网络或错峰重跑对应命令。
- 本脚本仅供个人学习备份使用。
