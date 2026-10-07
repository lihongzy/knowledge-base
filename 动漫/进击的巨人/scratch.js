const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

// 解析 dm84.tv 上《进击的巨人》各条目的剧集播放页，
// 提取每集的 iframe 播放器地址，写入 players.json。
//
// 用法：
//   node scratch.js                # 默认解析全部条目（写入 players.json）
//   node scratch.js main           # 只抓日配主线六季
//   node scratch.js cn             # 只抓国语版
//   node scratch.js extra          # 只抓剧场版/衍生
//   node scratch.js s1 s3 finale   # 指定条目 key

// 条目清单 CATALOG / 分组 GROUPS 见同目录 catalog.js。
const { BASE_URL, CATALOG, GROUPS } = require("./catalog");

// 站点 cookie（2026-10-06 从浏览器请求复制，仅发给 dm84.tv）。
// PHPSESSID 为会话标识；若失效（请求被拒/302），从浏览器重新复制一个新的替换这里。
const COOKIE =
    "notice_show=1; PHPSESSID=b2bdsaaik412sf3r709atf0ntp; _gc_vhegwd=7; " +
    "history=%5B%7B%22name%22%3A%22%u8FDB%u51FB%u7684%u5DE8%u4EBA%20%u7F16%u5E74%u53F2%22%2C%22pic%22%3A%22%22%2C%22link%22%3A%22/p/2190-1-1.html%22%2C%22part%22%3A%22%22%7D%2C%7B%22name%22%3A%22%u8FDB%u51FB%u7684%u5DE8%u4EBAOAD%22%2C%22pic%22%3A%22%22%2C%22link%22%3A%22/p/2187-1-1.html%22%2C%22part%22%3A%22%u7B2C1%u96C6%22%7D%2C%7B%22name%22%3A%22%u8FDB%u51FB%u7684%u5DE8%u4EBA%20%u7B2C%u4E8C%u5B63%u56FD%u8BED%u7248%22%2C%22pic%22%3A%22%22%2C%22link%22%3A%22/p/3082-1-1.html%22%2C%22part%22%3A%22%u7B2C1%u96C6%22%7D%2C%7B%22name%22%3A%22%u8FDB%u51FB%u7684%u5DE8%u4EBA%u56FD%u8BED%u7248%22%2C%22pic%22%3A%22%22%2C%22link%22%3A%22/p/3081-1-3.html%22%2C%22part%22%3A%22%u7B2C3%u96C6%22%7D%2C%7B%22name%22%3A%22%u8FDB%u51FB%u7684%u5DE8%u4EBA%u5267%u573A%u7247%uFF1A%u540E%u7BC7%B7%u81EA%u7531%u4E4B%u7FFC%22%2C%22pic%22%3A%22%22%2C%22link%22%3A%22/p/2188-1-1.html%22%2C%22part%22%3A%22%22%7D%2C%7B%22name%22%3A%22%u8FDB%u51FB%u7684%u5DE8%u4EBA%u7B2C%u4E00%u5B63%22%2C%22pic%22%3A%22%22%2C%22link%22%3A%22/p/72-1-2.html%22%2C%22part%22%3A%22%u7B2C2%u96C6%22%7D%2C%7B%22name%22%3A%22Re%uFF1A%u4ECE%u96F6%u5F00%u59CB%u7684%u5F02%u4E16%u754C%u751F%u6D3B%20%u7B2C%u4E00%u5B63%22%2C%22pic%22%3A%22%22%2C%22link%22%3A%22/p/109-1-1.html%22%2C%22part%22%3A%22%u7B2C1%u96C6%22%7D%5D";

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0";

const headers = {
    accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "accept-language": "zh-CN,zh;q=0.9,en;q=0.7",
    "cache-control": "max-age=0",
    "upgrade-insecure-requests": "1",
    "user-agent": UA,
    cookie: COOKIE,
};

const http = axios.create({ timeout: 25000, headers });

async function getHtml(url, referer = BASE_URL + "/") {
    console.log("  请求:", url);
    const res = await http.get(url, { headers: { referer } });
    return res.data;
}

/** 从详情页解析某一线路的全部剧集链接。 */
async function getEpisodes(item) {
    const detailFull = new URL(item.detailUrl, BASE_URL).href;
    const html = await getHtml(detailFull);
    const $ = cheerio.load(html);

    const vid = item.detailUrl.match(/\/v\/(\d+)\.html/)?.[1];
    if (!vid) throw new Error("详情页 URL 无法解析作品 ID: " + item.detailUrl);

    // /p/{vid}-{line}-{index}.html
    const re = new RegExp(`^\\/p\\/${vid}-${item.line}-(\\d+)\\.html$`);

    const map = new Map();
    $("a").each((_, el) => {
        const href = $(el).attr("href") || "";
        const title = ($(el).text() || "").trim();
        const m = href.match(re);
        if (!m) return;
        const index = Number(m[1]);
        if (!map.has(index)) {
            map.set(index, {
                index,
                title,
                url: new URL(href, BASE_URL).href,
            });
        }
    });

    return [...map.values()]
        .sort((a, b) => a.index - b.index)
        .map((ep) => ({
            ...ep,
            seasonKey: item.key,
            seasonName: item.name,
        }));
}

/** 从剧集页提取 iframe 播放器地址。 */
function extractIframe(html, pageUrl) {
    const $ = cheerio.load(html);
    let iframeUrl = null;
    $("iframe").each((_, el) => {
        const src = $(el).attr("src");
        if (!src) return;
        if (src.includes("player") || src.includes("url=") || src.includes("hhplayer")) {
            iframeUrl = new URL(src, pageUrl).href;
        }
    });
    return iframeUrl;
}

function parsePlayer(iframeUrl) {
    if (!iframeUrl) return null;
    try {
        const u = new URL(iframeUrl);
        return {
            host: u.host,
            iframeUrl,
            playerToken: u.searchParams.get("url") || null,
        };
    } catch {
        return null;
    }
}

/** 解析单集，返回带 season 信息的记录。 */
async function parseEpisode(ep) {
    try {
        const html = await getHtml(ep.url);
        const iframeUrl = extractIframe(html, ep.url);
        return {
            seasonKey: ep.seasonKey,
            seasonName: ep.seasonName,
            episode: ep.index,
            title: ep.title,
            pageUrl: ep.url,
            iframeUrl,
            player: parsePlayer(iframeUrl),
        };
    } catch (error) {
        return {
            seasonKey: ep.seasonKey,
            seasonName: ep.seasonName,
            episode: ep.index,
            title: ep.title,
            pageUrl: ep.url,
            error: error.response?.status || error.message,
        };
    }
}

/** 解析命令行参数为条目清单（无参数时解析全部）。 */
function resolveTargets(argv) {
    if (!argv.length) return Object.values(CATALOG);

    if (argv.includes("all")) {
        return Object.values(CATALOG);
    }

    const targets = [];
    for (const arg of argv) {
        if (GROUPS[arg]) {
            GROUPS[arg].forEach((k) => targets.push(CATALOG[k]));
            continue;
        }
        if (CATALOG[arg]) {
            targets.push(CATALOG[arg]);
            continue;
        }
        console.log("忽略无法识别的参数:", arg);
    }
    return targets;
}

async function main() {
    const targets = resolveTargets(process.argv.slice(2));

    if (!targets.length) {
        console.log("没有可解析的条目。");
        return;
    }

    console.log("待解析条目:", targets.map((t) => `${t.name}(${t.key})`).join("、"));

    const results = [];

    for (const item of targets) {
        console.log(`\n===== ${item.name} =====`);
        let episodes;
        try {
            episodes = await getEpisodes(item);
        } catch (error) {
            console.log("  获取剧集列表失败:", error.message);
            continue;
        }
        console.log(`  共 ${episodes.length} 集`);

        for (const ep of episodes) {
            const rec = await parseEpisode(ep);
            results.push(rec);
            console.log(
                `  第 ${ep.index} 集 ${rec.player ? "OK" : "无播放器: " + (rec.error || "")}`
            );
            await new Promise((r) => setTimeout(r, 400));
        }
    }

    const outFile = path.join(__dirname, "players.json");
    fs.writeFileSync(outFile, JSON.stringify(results, null, 2), "utf8");

    const ok = results.filter((r) => r.player?.playerToken).length;
    console.log("\n==========================");
    console.log(`完成：共 ${results.length} 集，成功解析 ${ok} 集`);
    console.log("结果保存到", outFile);
}

main().catch((error) => {
    console.error("运行出错:", error);
    process.exit(1);
});
