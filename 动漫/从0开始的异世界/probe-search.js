const axios = require("axios");
const cheerio = require("cheerio");

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0";

const http = axios.create({
    timeout: 25000,
    headers: {
        accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.7",
        "user-agent": UA,
    },
});

async function getHtml(url, referer) {
    const res = await http.get(url, {
        headers: referer ? { referer } : {},
    });
    return res.data;
}

async function search(kw) {
    const url =
        "https://dm84.tv/s----------.html?wd=" +
        encodeURIComponent(kw);
    const html = await getHtml(url, "https://dm84.tv/");
    const $ = cheerio.load(html);

    const seen = new Map();
    $("a").each((_, el) => {
        const href = $(el).attr("href") || "";
        const name = ($(el).text() || "").trim();
        const m = href.match(/^\/v\/(\d+)\.html$/);
        if (m && name) {
            if (!seen.has(m[1])) {
                seen.set(m[1], { id: m[1], name, href: "https://dm84.tv/v/" + m[1] + ".html" });
            }
        }
    });

    console.log("SEARCH:", url);
    console.log("找到条目：");
    [...seen.values()].forEach((x) => console.log(" -", x.id, x.name, x.href));
    return [...seen.values()];
}

async function main() {
    const items = await search("进击的巨人");
    console.log("\n共", items.length, "个 v 详情页\n");

    for (const it of items) {
        const html = await getHtml(it.href, "https://dm84.tv/");
        const $ = cheerio.load(html);

        // 播放器线路名称（如 线路1/线路2）及其对应分组
        const lines = [];
        $("h3, .downfront, .tab, ul li a").remove; // noop
        // dm84 一般用 <div class="playbox"> 或 <ul class="play"> 分组，标题在 h3/label
        $(".taba, .nav, .playlist .title").remove; // noop

        // 打印所有分组标题（尽力识别）
        const groups = [];
        $(".vide li, .stitle, .playerBox, .content a").remove; // noop

        console.log("=====", it.id, it.name, "=====");
        console.log(it.href);

        await new Promise((r) => setTimeout(r, 400));
    }
}

main().catch((e) => console.log("ERR", e.message));
