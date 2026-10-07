# 进击的巨人 · 视频解析下载脚本

从 dm84.tv 解析《进击的巨人》各季 / 剧场版的视频下载地址，并下载保存。

分两步：**先解析（scratch.js）生成 `players.json`，再下载（downloadVideo.js）**。

## 环境准备

在本目录（`动漫/进击的巨人`）下执行：

```powershell
npm install
```

另外：`hls` 类线路需要本地安装 **ffmpeg**（并在 PATH 中可用），用于将分片拼接后的 .ts 合成 mp4；`direct` 类线路不需要。

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
- **按 key 固定下载策略**：每个季 key 用哪种下载方式由 `downloadVideo.js` 里的 `SEASON_STRATEGY` 策略表写死（基于实测），运行时不探测、不降级；源线路变了就改表。
- **断点续跑**：已完整下载的集会跳过，不重复下载。
- **完整性校验**：先写 `.part` 临时文件，字节数校验通过后才重命名为 `.mp4`；过小或实为 m3u8 文本的文件会被删除重下。
- **失败重试**：遇 TLS 断连 / 代理超时等瞬时网络错误，每集最多重试 3 次（指数退避）。

### 三类下载方式（`SEASON_STRATEGY` 的 kind）

| kind | 适用源 | 下载方式 |
| --- | --- | --- |
| `direct` + Referer | 腾讯 `om.tc.qq.com` | 单文件 mp4 流式下载，请求带 `Referer: dm84.tv` |
| `direct` 无 Referer | 小红书 `xhscdn`（带任何 Referer 回 403）、腾讯 `photovideo`（带 Referer 伪装成 404） | 单文件 mp4，请求**不带** Referer（浏览器 <video> 也是不带 referrer 才能过） |
| `hls` | `hhjx` 播放列表（ljcdn / qpic.cn 图床分片） | 逐分片下载（不带 Referer）→ 分片是套了假 PNG 头的 MPEG-TS，按 188 字节对齐找 0x47 同步头切掉假头 → 拼接 .ts → ffmpeg `-c copy -bsf:a aac_adtstoasc -f mp4` 合成 |
| `dead` | — | 已确认本站拿不到（原因见对照表），直接跳过，不发解析请求不重试 |

> `dead` 不是脚本问题，无法靠改请求头解决：`parse 400` = hhjx 服务器拒绝给地址（源不被解析器支持）；`分片 404` = 视频文件已从源站 CDN 删除。若想救，改用 `scratch.js` 重抓时换页面上的其他线路，或等源恢复后把表中对应行从 `dead` 改回 `hls`。

## 条目 key 对照表

状态为 2026-10 实测/实装结果。

| key | 名称 | 详情页 | 分组 | 下载方式 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `s1` | 第一季 | /v/72.html | main | direct + Referer | ✅ 已下全 34 集（含 9 集 SP） |
| `s2` | 第二季 | /v/73.html | main | hls | ✅ 已下全 12 集 |
| `s3` | 第三季 | /v/74.html | main | hls | ✅ 已下全 22 集 |
| `s4` | 第四季 | /v/75.html | main | direct 无 Referer | ✅ 已下全 16 集 |
| `final2` | 最终季 Part.2 | /v/1397.html | main | hls | ✅ 已下全 12 集 |
| `finale` | 最终季 完结篇 | /v/3811.html | main | hls | ✅ 可下（当前已下前篇） |
| `cn1` | 第一季国语版 | /v/3081.html | cn | dead | ❌ parse 400 |
| `cn2` | 第二季国语版 | /v/3082.html | cn | dead | ❌ parse 400 |
| `cn3` | 第三季国语版 | /v/3083.html | cn | dead | ❌ parse 400 |
| `cn4` | 第四季国语版 | /v/3084.html | cn | dead | ❌ parse 400 |
| `movie1` | 剧场版·红莲之箭 | /v/2189.html | extra | direct 无 Referer | ✅ 已下（约 950MB） |
| `movie2` | 剧场版·自由之翼 | /v/2188.html | extra | direct 无 Referer | ✅ 已下（约 950MB） |
| `movie3` | 剧场版·觉醒的咆哮 | /v/2185.html | extra | hls | ✅ 已下 |
| `chronicle` | 编年史 | /v/2190.html | extra | dead | ❌ 源片在 yishihui 已 404 |
| `oad` | OAD | /v/2187.html | extra | dead | ❌ parse 400 |
| `sidestory` | 外传·无悔的选择 | /v/2184.html | extra | dead | ❌ 源片在 kwimgs 已 404 |
| `lostgirls` | LOST GIRLS | /v/2186.html | extra | dead | ❌ parse 400 |
| `junior` | 进击！巨人中学 | /v/1170.html | extra | dead | ❌ parse 400 |

> `main` / `cn` / `extra` 也可直接当作参数传入，代表整组。`dead` 条目运行时会打印原因并计入“线路不可用”，不会反复重试。

## 文件说明

| 文件 | 作用 |
| --- | --- |
| `scratch.js` | 解析各集播放页，生成 `players.json` |
| `downloadVideo.js` | 读取 `players.json` 解析直链并下载 |
| `catalog.js` | 条目清单与分组（scratch.js / downloadVideo.js 共用） |
| `players.json` | 解析结果（每集的页面、iframe、播放器 token） |
| `videos/` | 下载得到的 `.mp4`，按季分目录 |

## 注意事项

- 脚本默认使用站点**线路 1**（`hhjx` 播放器），只有该线路可被本脚本解析下载；`dead` 条目若想补救，需换其他线路用 `scratch.js` 重抓。
- 解析出的直链 / 播放列表 token 均有时效，下载脚本采用「解析后立即下载」，无需手动处理。
- 防盗链规律总结：`om.tc.qq.com` 需带 `Referer: dm84`；`xhscdn` / `photovideo` / ljcdn 分片则**必须不带** Referer（浏览器 <video> 请求不带 referrer，脚本照此行事）。
- 若个别集持续失败，多为代理 / 网络链路不稳（如本地代理出口 `198.18.0.x` 偶发 ETIMEDOUT），重试机制可吸收；也可更换网络或错峰重跑对应命令。
- `videos/` 目录已在仓库根 `.gitignore` 中排除，视频不入库，随时可用本脚本重新生成。
- 本脚本仅供个人学习备份使用。
