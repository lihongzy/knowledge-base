const { existsSync } = require("fs");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs/promises");
const path = require("path");

const BASE_URL = "https://www.linovelib.com";
// 章节目录页
const CATALOG_URL = "https://www.linovelib.com/novel/9/catalog";

// 输出目录：Markdown 与图片都放在这里
const OUTPUT_DIR = path.join(__dirname, "chapters");
const IMAGES_DIR = path.join(OUTPUT_DIR, "images");
// 小说清单文件：记录“卷 -> 章节”的结构与文件名，供站点按卷展示
const MANIFEST_PATH = path.join(__dirname, "novel.json");
// 小说 id = 所在文件夹名（如“游戏人生”）
const NOVEL_ID = path.basename(__dirname);
const NOVEL_TITLE = "游戏人生 NO GAME NO LIFE";
// 小说 URL 片段：必须为 ASCII，否则 next dev 在 output:export 下无法匹配动态段
const NOVEL_SLUG = "no-game-no-life";

// 每章之间的请求间隔（毫秒），避免过快被 Cloudflare 限流
const REQUEST_DELAY = 800;

// 从浏览器复制的完整请求头（含 Cloudflare 的 cf_clearance 等 cookie）。
// 注意：cf_clearance 会过期，失效后需重新从浏览器抓取并替换。
const HEADERS = {
    accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "accept-language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
    "cache-control": "no-cache",
    pragma: "no-cache",
    priority: "u=0, i",
    "upgrade-insecure-requests": "1",
    referer: "https://www.linovelib.com/novel/9.html",
    "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
    cookie:
        "user_tz=Asia%2FShanghai; jieqiSearchCss=497476.f8Muxsx5j63EEbBleDZWL1ZLKax38YE5o-9RsPhJREQ; jieqiSearchJs=497476.UiIhFLhCkP8_JQ4_75DV23eQD_CvGDUXQ0qoUUvOsBY; cf_clearance=lW08_D6sDRN3vSMw73TUesJIHs3dyr3vqo9arfFxC0w-1790915479-1.2.1.1-xt0Fr6oBIDlBGtmLZ5gm1MnFchJ7Ge8ItufrJ.8ln1hlhNLJyrWKdVpNdejPYHd9iPak_dYlu3rYEhCf7hnAhJa.IHI6h.nIUDhRfAdzRD.Q2QoHL12Mx.bcyj9RT43wxKJhoZGCpKysf4LMdDSw947345hL1e90.6x7yqyB9JDxh3.n78EDWBnJbkHBDfKhKws902l0HyoG_RTZivmhhESLI_.B9mmb6zV_1UfSUgL_f5SAn3qT6tHR1.I2NkeEXnsZ4YcKKwTYC7Ggzzrw24COrKXCkzKc3AdOefBKw6wkqzMPxsVF9TW7F6kLhAKy8FcjGU58NGsmRbg41EgvFhH_xHCR_l4LD_HgJnYHMv8; jieqiSearchTicket=6f285663738536bdb475c5eb64c8be09c1d1da840ad4045e.dobM0eRLS4aXHKxAjJp0rpZhMHY1FnZNFu7m90D7Idc; jieqiRecentRead=9.2082.0.2.1790915501.0",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 带重试的 GET：html 用默认文本，图片用 arraybuffer
async function getRequest(url, options = {}, retries = 3) {
    for (let attempt = 1; ; attempt++) {
        try {
            return await axios.get(url, { headers: HEADERS, timeout: 20000, ...options });
        } catch (err) {
            const status = err.response && err.response.status;
            if (attempt >= retries || (status && status < 500 && status !== 429)) throw err;
            await sleep(1000 * attempt); // 网络/限流类错误，退避后重试
        }
    }
}

// 解析目录：按分卷分组，收集每卷下的章节标题与链接
async function fetchCatalog() {
    const { data: html } = await getRequest(CATALOG_URL);
    const $ = cheerio.load(html);
    const volumes = [];

    $(".volume").each((_, vol) => {
        const $vol = $(vol);
        const volumeTitle = $vol.find(".volume-info h2 a").first().text().trim();

        const chapters = [];
        $vol.find(".chapter-list li a").each((_, a) => {
            const $a = $(a);
            const title = $a.text().trim();
            const href = $a.attr("href");
            if (!title) return;
            // 锁定章节：目录里 href 是 javascript:cid(0)，没有真实链接。
            // 但它们并非付费内容，从“上一章末页”的下一页链接可解析出真实地址，
            // 这里先保留占位，稍后由 resolveLockedChapters 补齐。
            if (!href || !href.startsWith("/")) {
                chapters.push({ title, url: null, locked: true });
                return;
            }

            chapters.push({ title, url: new URL(href, BASE_URL).href });
        });

        if (chapters.length) volumes.push({ volumeTitle, chapters });
    });

    return volumes;
}

// 从“上一章”URL 出发，跟完同章分页后取末页指向下一章的链接（base id 不同）
// 这是锁定章节（javascript:cid(0)）获取真实地址的唯一途径
async function findNextChapterUrl(prevUrl) {
    const base = chapterBaseId(prevUrl);
    let pageUrl = prevUrl;
    let guard = 0;
    while (pageUrl && guard++ < 50) {
        const { data: html } = await getRequest(pageUrl);
        const $ = cheerio.load(html);

        let sameChapterNext = null;
        let outsideNext = null;
        $(".mlfy_page a").each((_, a) => {
            const href = $(a).attr("href");
            if (!href || !/下一页/.test($(a).text().trim())) return;
            const abs = new URL(href, BASE_URL).href;
            if (chapterBaseId(abs) === base) sameChapterNext = abs;
            else outsideNext = abs;
        });

        if (sameChapterNext) {
            pageUrl = sameChapterNext;
            await sleep(REQUEST_DELAY);
            continue;
        }
        if (outsideNext) return outsideNext;
        throw new Error("末页未找到指向下一章的链接");
    }
    throw new Error("翻页次数超限");
}

// 按阅读顺序解析所有锁定章节的真实 URL（连续锁定也能链式解析）
async function resolveLockedChapters(volumes) {
    const flat = volumes.flatMap((vol) => vol.chapters);
    let resolved = 0;
    for (let i = 1; i < flat.length; i++) {
        const ch = flat[i];
        if (!ch.locked) continue;
        const prev = flat[i - 1];
        if (!prev.url) continue; // 上一章也未解析，无法定位，保留锁定状态跳过
        try {
            ch.url = await findNextChapterUrl(prev.url);
            delete ch.locked;
            resolved += 1;
            console.log(`  解析锁定章节「${ch.title}」 => ${ch.url}`);
        } catch (err) {
            console.warn(`  无法解析锁定章节「${ch.title}」: ${err.message}`);
        }
        await sleep(REQUEST_DELAY);
    }
    return resolved;
}

// 从 /novel/9/2041.html 或 /novel/9/2041_2.html 提取章节基础 id（2041）
function chapterBaseId(url) {
    const m = url.match(/\/(\d+)(?:_\d+)?\.html/);
    return m ? m[1] : null;
}

// 下载图片到本地，返回相对于 md 文件所在目录（OUTPUT_DIR）的路径
// 站点图片为懒加载：真实地址在 data-src，src 只是占位图
function realImgSrc($, imgEl) {
    const $el = $(imgEl);
    const candidates = [
        $el.attr("data-src"),
        $el.attr("data-original"),
        $el.attr("src"),
    ];
    return candidates.find((s) => s && /^https?:/i.test(s)) || null;
}

async function downloadImage($, imgEl, chapterId, seq) {
    const src = realImgSrc($, imgEl);
    if (!src) return null;

    const ext = (path.extname(new URL(src).pathname) || ".jpg").toLowerCase();
    const fileName = `${chapterId}_${seq}${ext}`;
    const filePath = path.join(IMAGES_DIR, fileName);

    try {
        const { data } = await getRequest(src, { responseType: "arraybuffer" });
        await fs.writeFile(filePath, Buffer.from(data));
        // md 文件在 OUTPUT_DIR 下，图片在 OUTPUT_DIR/images 下
        return path.posix.join("images", fileName);
    } catch (err) {
        console.warn(`  图片下载失败 ${src}: ${err.message}`);
        return null;
    }
}

// 按 DOM 顺序把一页正文追加到 lines；遇到图片就下载并在原位插入 ![]()
async function walkContent($, lines, chapterId, imgCounter) {
    const nodes = $("#TextContent").contents();

    for (const el of nodes) {
        if (el.type === "text") {
            const t = (el.data || "").replace(/\s+/g, " ").trim();
            if (t) lines.push(t, "");
            continue;
        }
        if (!el.name) continue;

        const $el = $(el);
        const tag = el.name.toLowerCase();

        // 跳过广告 / 脚本 / “点击查看”等 UI 噪音节点
        if (["script", "style"].includes(tag) || $el.hasClass("dag")) continue;
        if ($el.attr("id") === "show-more-images") continue;

        // 收集该节点内所有图片（<img> 自身，或容器内嵌套的多张图）
        const imgEls = tag === "img" ? [$el] : $el.find("img");
        if (imgEls.length) {
            for (const $img of imgEls) {
                if (!realImgSrc($, $img[0])) continue; // 占位图跳过
                imgCounter.n += 1;
                const rel = await downloadImage($, $img[0], chapterId, imgCounter.n);
                if (rel) lines.push(`![插图 ${imgCounter.n}](${rel})`, "");
            }
        } else if (tag === "p") {
            const t = $el.text().replace(/\s+/g, " ").trim();
            if (t) lines.push(t, "");
        } else if (tag === "center") {
            const t = $el.text().replace(/\s+/g, " ").trim();
            if (t) lines.push(`---\n\n${t}\n`, "");
        } else if (tag === "br") {
            // <br> 仅作为视觉空行，段落已用空行分隔，忽略
        } else {
            const t = $el.text().replace(/\s+/g, " ").trim();
            if (t) lines.push(t, "");
        }
    }
}

// 抓取单章（含分页），返回 Markdown 文本
async function fetchChapter(chapter) {
    const base = chapterBaseId(chapter.url);
    const lines = [`# ${chapter.title}`, "", `> 来源：${chapter.url}`, ""];
    const imgCounter = { n: 0 };

    let pageUrl = chapter.url;
    let guard = 0;
    while (pageUrl && guard++ < 50) {
        const { data: html } = await getRequest(pageUrl);
        const $ = cheerio.load(html);

        await walkContent($, lines, base, imgCounter);

        // 找“下一页”，且必须仍属于同一章（base id 不变）
        let next = null;
        $(".mlfy_page a").each((_, a) => {
            const href = $(a).attr("href");
            const text = $(a).text().trim();
            if (!href || !/下一页/.test(text)) return;
            if (chapterBaseId(href) === base) next = new URL(href, BASE_URL).href;
        });
        pageUrl = next;
        if (pageUrl) await sleep(REQUEST_DELAY);
    }

    return { markdown: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n", imgCount: imgCounter.n };
}

// 去掉文件名里的非法字符
function safeName(s) {
    return s.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
}

// 给目录卷列表补充全局序号与文件名，得到展平的章节数组（与抓取写盘规则完全一致）
function decorateVolumes(volumes) {
    const all = [];
    let seq = 0;
    const decorated = volumes.map((vol) => ({
        title: vol.volumeTitle,
        chapters: vol.chapters.map((ch) => {
            seq += 1;
            const slug = String(seq).padStart(3, "0");
            const file = `${slug}-${safeName(ch.title)}.md`;
            const item = { seq, slug, title: ch.title, file, url: ch.url };
            all.push({ ...item, volumeTitle: vol.volumeTitle });
            return item;
        }),
    }));
    return { decorated, all };
}

// 生成并写盘 novel.json（只需目录信息，无需逐章抓取）
async function writeManifest(volumes) {
    const { decorated } = decorateVolumes(volumes);
    const manifest = {
        id: NOVEL_ID,
        slug: NOVEL_SLUG,
        title: NOVEL_TITLE,
        sourceCatalog: CATALOG_URL,
        volumes: decorated,
    };
    await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
    return manifest;
}

async function runManifestOnly() {
    const volumes = await fetchCatalog();
    await resolveLockedChapters(volumes);
    const manifest = await writeManifest(volumes);
    const total = manifest.volumes.reduce((n, v) => n + v.chapters.length, 0);
    console.log(`已生成 novel.json：${manifest.volumes.length} 卷，${total} 章。`);
}

async function main() {
    // 命令：node scratch.js manifest        仅生成 novel.json（含锁定章节解析）
    //       node scratch.js missing       只补抓本地尚不存在的章节
    //       node scratch.js [起始序号] [章数]  抓取正文（默认从第 1 章、全部）
    const mode = process.argv[2];
    if (mode === "manifest") return runManifestOnly();
    const onlyMissing = mode === "missing";

    const startIndex = onlyMissing ? 1 : Number(process.argv[2] || 1);
    const limit = onlyMissing ? Infinity : Number(process.argv[3] || Infinity);

    await fs.mkdir(IMAGES_DIR, { recursive: true });

    const volumes = await fetchCatalog();
    await resolveLockedChapters(volumes);
    // 每次抓取都刷新清单，保证站点卷/章结构与文件名同步
    await writeManifest(volumes);

    const { all } = decorateVolumes(volumes);
    console.log(`目录共 ${volumes.length} 卷，${all.length} 章。`);

    let done = 0;
    for (let i = startIndex - 1; i < all.length && done < limit; i++) {
        const ch = all[i];
        if (!ch.url) {
            console.warn(`[${String(ch.seq).padStart(3, "0")}] 跳过（链接未能解析）：${ch.title}`);
            continue;
        }
        if (onlyMissing && existsSync(path.join(OUTPUT_DIR, ch.file))) continue;
        console.log(`[${String(ch.seq).padStart(3, "0")}] ${ch.title}`);

        try {
            const { markdown, imgCount } = await fetchChapter(ch);
            await fs.writeFile(path.join(OUTPUT_DIR, ch.file), markdown, "utf8");
            console.log(`  -> chapters/${ch.file}（${imgCount} 图）`);
            done += 1;
        } catch (err) {
            console.error(`  跳过 ${ch.title}: ${err.message}`);
        }

        await sleep(REQUEST_DELAY);
    }

    console.log(`\n完成，共写入 ${done} 章。`);
}

main().catch(console.error);
