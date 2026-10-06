const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

const BASE_URL = "https://dm84.tv";
const DETAIL_URL = "https://dm84.tv/v/109.html";

const COOKIE =
    "notice_show=1; PHPSESSID=b2bdsaaik412sf3r709atf0ntp; history=%5B%7B%22name%22%3A%22Re%uFF1A%u4ECE%u96F6%u5F00%u59CB%u7684%u5F02%u4E16%u754C%u751F%u6D3B%20%u7B2C%u4E00%u5B63%22%2C%22pic%22%3A%22%22%2C%22link%22%3A%22/p/109-1-1.html%22%2C%22part%22%3A%22%u7B2C1%u96C6%22%7D%5D";

const headers = {
    accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",

    "accept-language":
        "zh-CN,zh;q=0.9,en-CN;q=0.8,en;q=0.7",

    "cache-control": "max-age=0",

    "upgrade-insecure-requests": "1",

    "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0",

    cookie: COOKIE,
};

const http = axios.create({
    timeout: 20000,
    headers,
});

async function getHtml(url, referer = DETAIL_URL) {
    console.log("请求:", url);

    const res = await http.get(url, {
        headers: {
            ...headers,
            referer,
        },
    });

    return res.data;
}

/**
 * 只获取线路 1 的 25 集
 *
 * 只保留：
 * /p/109-1-1.html
 * ...
 * /p/109-1-25.html
 */
async function getEpisodeUrls() {
    const html = await getHtml(
        DETAIL_URL,
        "https://www.google.com/"
    );

    const $ = cheerio.load(html);

    const map = new Map();

    $("a").each((_, el) => {
        const href = $(el).attr("href");

        if (!href) return;

        const match = href.match(
            /^\/p\/109-1-(\d+)\.html$/
        );

        if (!match) return;

        const episode = Number(match[1]);

        if (
            episode < 1 ||
            episode > 25
        ) {
            return;
        }

        map.set(episode, {
            episode,
            url: new URL(
                href,
                BASE_URL
            ).href,
        });
    });

    return [...map.values()].sort(
        (a, b) =>
            a.episode - b.episode
    );
}

/**
 * 提取 iframe 播放器地址
 */
function extractIframe(
    html,
    pageUrl
) {
    const $ = cheerio.load(html);

    let iframeUrl = null;

    $("iframe").each((_, el) => {
        const src =
            $(el).attr("src");

        if (!src) return;

        if (
            src.includes("hhplayer") ||
            src.includes("player") ||
            src.includes("url=")
        ) {
            iframeUrl = new URL(
                src,
                pageUrl
            ).href;
        }
    });

    return iframeUrl;
}

/**
 * 解析播放器信息
 */
function parsePlayerUrl(
    iframeUrl
) {
    if (!iframeUrl) {
        return null;
    }

    try {
        const url =
            new URL(iframeUrl);

        return {
            host: url.host,

            iframeUrl,

            playerToken:
                url.searchParams.get(
                    "url"
                ) || null,
        };
    } catch {
        return null;
    }
}

/**
 * 解析单集
 */
async function parseEpisode(
    item
) {
    try {
        const html =
            await getHtml(
                item.url,
                DETAIL_URL
            );

        const iframeUrl =
            extractIframe(
                html,
                item.url
            );

        const player =
            parsePlayerUrl(
                iframeUrl
            );

        return {
            episode:
            item.episode,

            pageUrl:
            item.url,

            iframeUrl,

            player,
        };
    } catch (error) {
        return {
            episode:
            item.episode,

            pageUrl:
            item.url,

            error:
                error.response
                    ?.status ||
                error.message,
        };
    }
}

async function main() {
    console.log(
        "获取作品页面..."
    );

    const episodes =
        await getEpisodeUrls();

    console.log(
        `\n找到 ${episodes.length} 集\n`
    );

    episodes.forEach(
        item => {
            console.log(
                `第 ${item.episode} 集`,
                item.url
            );
        }
    );

    const results = [];

    for (
        const item of episodes
        ) {
        console.log(
            "\n--------------------------"
        );

        const result =
            await parseEpisode(
                item
            );

        results.push(
            result
        );

        console.log(
            `第 ${item.episode} 集`
        );

        console.log(
            "页面:",
            result.pageUrl
        );

        if (
            result.iframeUrl
        ) {
            console.log(
                "播放器:",
                result.iframeUrl
            );

            console.log(
                "播放器参数:",
                result.player
                    ?.playerToken
            );
        } else {
            console.log(
                "没有找到播放器 iframe"
            );
        }

        // 每集间隔 500ms
        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    500
                )
        );
    }

    fs.writeFileSync(
        "players.json",

        JSON.stringify(
            results,
            null,
            2
        ),

        "utf8"
    );

    console.log(
        "\n=========================="
    );

    console.log(
        `完成，共处理 ${results.length} 集`
    );

    console.log(
        "结果保存到 players.json"
    );
}

main().catch(
    console.error
);