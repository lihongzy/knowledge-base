# 从0开始的异世界 · 视频下载脚本

单纯用于下载《Re：从零开始的异世界生活》动画视频的 Node 脚本。

## 工作流程

1. `scratch.js` 抓取各集播放页，把每集的播放器信息存入 `players.json`。
2. `downloadVideo.js` 读取 `players.json`，逐集打开播放页解析出真实视频直链，下载保存为 `videos/第XX集.mp4`。

## 使用

```powershell
# 安装依赖
npm install

# 抓取播放器信息，生成 / 更新 players.json（一般只需运行一次）
node scratch.js

# 下载全部集数
node downloadVideo.js

# 只下载指定区间（起始集 结束集）
node downloadVideo.js 1 10
```

## 特性

- **断点续跑**：已完整下载的集数直接跳过，不会重复下载。
- **完整性校验**：下载先写入 `.part` 临时文件，字节数校验通过后才重命名为 `.mp4`。
- **失败自动重试**：每集遇到 TLS 断连、连接超时等瞬时网络错误时，最多重试 3 次（指数退避）。

## 文件说明

| 文件 | 作用 |
| --- | --- |
| `scratch.js` | 抓取各集播放页，生成 `players.json` |
| `downloadVideo.js` | 解析直链并下载视频的主脚本 |
| `players.json` | 每集的播放器信息（集数、页面、iframe 地址等） |
| `videos.json` | 各集视频直链的中间记录 |
| `videos/` | 下载得到的 `.mp4` 成品 |

## 注意

- 解析出的视频直链带有时效，脚本采用「解析后立即下载」，请勿手动复制 URL 延后使用。
- 若个别集持续失败，多为代理/网络链路不稳，可挂或更换代理节点、错峰重跑。
- 本脚本仅供个人学习备份使用。
