const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const axios = require("axios");

// 读取 scratch.js 生成的 players.json，逐条解析真实视频直链并下载。
// 每一季保存到 videos/<季名>/ 下，文件名形如 01-标题.mp4。
//
// 每个季 key 的下载方式由 SEASON_STRATEGY 策略表写死（基于实测），
// 不做运行时探测/降级重试；源线路变了就改表。
//
// 用法：
//   node downloadVideo.js               # 下载 players.json 里的全部
//   node downloadVideo.js main          # 下载整组（main / cn / extra / all）
//   node downloadVideo.js s1 finale     # 只下载指定季（seasonKey，可多个）

// 季 key / 组名与 scratch.js 共享自 catalog.js。
const { CATALOG, GROUPS } = require("./catalog");

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";

const OUTPUT_DIR = path.join(__dirname, "videos");

const PAGE_HEADERS = {
    "User-Agent": UA,
    Accept: "*/*",
    Referer: "https://dm84.tv/",
};

// 小于一阈值字节的文件视为无效（m3u8 文本、HTML 错误页等），会被重新下载。
const MIN_VALID_BYTES = 1024 * 1024;

function loadPlayers() {
    const file = path.join(__dirname, "players.json");
    const list = JSON.parse(fs.readFileSync(file, "utf8"));

    // 只保留成功解析出播放器 token 且无错误的集。
    return list.filter((r) => r.iframeUrl && !r.error && r.player?.playerToken);
}

async function getBootstrap(iframeUrl) {
    const res = await axios.get(iframeUrl, {
        headers: PAGE_HEADERS,
        timeout: 30000,
    });

    const match = res.data.match(
        /window\.__HHJX_BOOTSTRAP__=(\{[\s\S]*?\});<\/script>/
    );
    if (!match) {
        throw new Error("页面中未找到 __HHJX_BOOTSTRAP__ 引导参数");
    }
    return JSON.parse(match[1]);
}

async function resolveVideoUrl(bootstrap, iframeUrl) {
    const origin = new URL(iframeUrl).origin;

    const body = {
        url: bootstrap.url,
        t: bootstrap.t,
        key: bootstrap.key,
    };
    if (bootstrap.act === 99) body.act = 99;

    const res = await axios.post(origin + "/api/parse", body, {
        headers: {
            "User-Agent": UA,
            "Content-Type": "application/json",
            Referer: iframeUrl,
            Origin: origin,
        },
        timeout: 60000,
    });

    if (res.data.code !== 200 || !res.data.url) {
        throw new Error("解析接口返回无效：" + JSON.stringify(res.data));
    }

    return String(res.data.url).replace(/^http:\/\//i, "https://");
}

async function downloadFile(videoUrl, output, headers = PAGE_HEADERS) {
    const partPath = output + ".part";

    try {
        const res = await axios.get(videoUrl, {
            headers,
            responseType: "stream",
            maxRedirects: 10,
            timeout: 180000,
        });

        const total = Number(res.headers["content-length"] || 0);
        const file = fs.createWriteStream(partPath);

        let downloaded = 0;

        res.data.on("data", (chunk) => {
            downloaded += chunk.length;
            if (total) {
                const percent = ((downloaded / total) * 100).toFixed(2);
                process.stdout.write(`\r  下载进度：${percent}%`);
            } else {
                process.stdout.write(
                    `\r  已下载：${(downloaded / 1024 / 1024).toFixed(2)} MB`
                );
            }
        });

        res.data.pipe(file);

        await new Promise((resolve, reject) => {
            file.on("finish", () => file.close(resolve));
            file.on("error", reject);
            res.data.on("error", reject);
        });

        process.stdout.write("\n");

        if (total) {
            const actual = fs.statSync(partPath).size;
            if (actual !== total) {
                throw new Error(`下载不完整（${actual}/${total} 字节），将重试`);
            }
        }

        fs.renameSync(partPath, output);
    } catch (error) {
        process.stdout.write("\n");
        if (fs.existsSync(partPath)) {
            fs.unlinkSync(partPath);
        }
        throw error;
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn, retries = 3) {
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt < retries) {
                const waitMs = attempt * 3000;
                console.log(
                    `  第 ${attempt}/${retries} 次尝试失败：${error.message}，${waitMs / 1000}s 后重试…`
                );
                await sleep(waitMs);
            }
        }
    }
    throw lastError;
}

/** 去掉 Windows/Linux 文件名非法字符。 */
function safeName(text) {
    return String(text)
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function buildFileName(rec) {
    const idx = String(rec.episode).padStart(2, "0");
    const title = safeName(rec.title);
    // 标题为纯数字或与序号重复时不再拼接。
    if (!title || title === String(rec.episode)) {
        return `第${idx}集.mp4`;
    }
    return `${idx}-${title}.mp4`;
}

/** 判断一个链接是否为 HLS(m3u8)。 */
function isHlsUrl(url) {
    return /\.m3u8($|\?)/i.test(url) || /\/playlist($|\/|\?)/i.test(url);
}

/** 读文件头部字节，判断实为 m3u8 播放列表（而非真视频）。 */
function looksLikePlaylist(file) {
    try {
        const fd = fs.openSync(file, "r");
        const buf = Buffer.alloc(16);
        const len = fs.readSync(fd, buf, 0, 16, 0);
        fs.closeSync(fd);
        return buf.slice(0, len).toString("latin1").trimStart().startsWith("#EXT");
    } catch {
        return false;
    }
}

/** 已存在的本地文件是否算完整有效（足够大且不是 m3u8 文本）。 */
function isValidExisting(file) {
    try {
        const st = fs.statSync(file);
        return st.isFile() && st.size >= MIN_VALID_BYTES && !looksLikePlaylist(file);
    } catch {
        return false;
    }
}

/** 调用 ffmpeg，完成后校验输出大小。 */
function runFfmpeg(args) {
    return new Promise((resolve, reject) => {
        const proc = spawn("ffmpeg", args, { windowsHide: true });
        let errTail = "";

        proc.stderr.on("data", (d) => {
            errTail = (errTail + d.toString()).slice(-2000);
        });
        proc.on("error", reject);
        proc.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`ffmpeg 退出码 ${code}: ${errTail.slice(-200)}`));
        });
    });
}

/** 复刻播放器 de()：在数据里查找 188 字节对齐的 0x47 同步头偏移，
 *  用于剥离分片开头伪装的 PNG 假头（本站分片实为套了假头的 MPEG-TS 视频）。 */
function findTSOffset(buf, limit) {
    const max = Math.min(buf.length - 377, limit);
    for (let o = 0; o <= max; o++) {
        if (buf[o] === 0x47 && buf[o + 188] === 0x47 && buf[o + 376] === 0x47) return o;
    }
    return -1;
}

/** 下载单个分片：不带 Referer（ljcdn 带 Referer 反而 403），并切掉伪装假头，返回干净 TS。 */
async function fetchSegmentClean(segUrl) {
    const res = await axios.get(segUrl, {
        headers: { "User-Agent": UA },
        responseType: "arraybuffer",
        timeout: 60000,
    });
    const buf = Buffer.from(res.data);
    let off = findTSOffset(buf, 4096);
    if (off < 0) off = findTSOffset(buf, buf.length); // 假头超过 4096 时全文件兜底
    return off >= 0 ? buf.slice(off) : buf;           // 找不到则原样返回（本就是 TS）
}

/** 手动下载 HLS：抓播放列表 -> 并发取分片(保序) -> 切假头 -> 拼成 .ts -> ffmpeg remux 成 mp4。 */
async function downloadViaHls(videoUrl, output) {
    const pl = await axios.get(videoUrl, {
        headers: PAGE_HEADERS,
        responseType: "text",
        timeout: 60000,
    });
    const segUrls = pl.data
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s && !s.startsWith("#"))
        .map((s) => new URL(s, videoUrl).href);

    if (!segUrls.length) throw new Error("播放列表里没有分片");
    console.log(`  HLS：共 ${segUrls.length} 个分片，下载并剥离伪装头…`);

    // 有限并发下载，结果按索引保序放入 parts，保证 TS 拼接顺序正确。
    const parts = new Array(segUrls.length);
    const queue = segUrls.map((u, i) => ({ u, i }));
    let done = 0;
    const CONC = 4;
    async function worker() {
        while (queue.length) {
            const { u, i } = queue.shift();
            parts[i] = await withRetry(() => fetchSegmentClean(u), 3);
            done++;
            process.stdout.write(`\r  分片进度：${done}/${segUrls.length}`);
        }
    }
    await Promise.all(Array.from({ length: CONC }, worker));
    process.stdout.write("\n");

    // 拼接为连续的 MPEG-TS。
    const tsPath = output + ".ts";
    const fh = fs.openSync(tsPath, "w");
    try {
        for (const p of parts) fs.writeSync(fh, p);
    } finally {
        fs.closeSync(fh);
    }

    // 本地 remux 成 mp4（源已是 H.264/AAC 的 TS，直接 copy 不转码）。
    const partPath = output + ".part";
    try {
        await runFfmpeg([
            "-hide_banner", "-loglevel", "error",
            "-i", tsPath,
            "-c", "copy", "-bsf:a", "aac_adtstoasc", "-movflags", "+faststart",
            // 输出临时文件后缀是 .part，ffmpeg 靠扩展名无法识别容器，必须显式 -f mp4。
            "-f", "mp4",
            "-y", partPath,
        ]);
        if (fs.statSync(partPath).size < MIN_VALID_BYTES) {
            throw new Error("合成产物过小，可能失败");
        }
        fs.renameSync(partPath, output);
        // 删中间 .ts 容错：Windows 大文件句柄/杀软可能瞬时占用，删不掉也不应连累整集重下。
        try { fs.unlinkSync(tsPath); } catch { /* 忽略残留 .ts */ }
    } catch (error) {
        if (fs.existsSync(partPath)) fs.unlinkSync(partPath);
        // remux 失败：保留拼好的 .ts（同样可直接播放），避免白下。
        const tsFinal = output.replace(/\.mp4$/i, "") + ".ts";
        if (fs.existsSync(tsFinal)) fs.unlinkSync(tsFinal);
        fs.renameSync(tsPath, tsFinal);
        console.log(`  remux 失败（${error.message}），已保存为 ${path.basename(tsFinal)}`);
    }
}

/** 每个季 key 的下载策略（2026-10 实测钉死，不在表里的 key 直接跳过不猜）：
 *  kind="direct"：单文件 mp4 直链；headers 固定该 CDN 能通过的那一组头。
 *    - xhscdn / photovideo：带任何外部 Referer 就被拒（403 或伪装成 404），必须不带。
 *    - om.tc.qq.com：需要带 Referer: dm84。
 *  kind="hls"：播放列表分片是套了假 PNG 头的 MPEG-TS，逐片下载（不带 Referer）、
 *    按 188 字节对齐找 0x47 同步头切假头、拼接 .ts、ffmpeg remux 成 mp4。
 *  kind="dead"：已确认本站拿不到，跳过不浪费重试（原因写死在 note）。 */
const SEASON_STRATEGY = {
    s1: { kind: "direct", headers: "referer", note: "腾讯 om.tc.qq.com 直链，需 Referer: dm84" },
    s2: { kind: "hls", note: "ljcdn 伪装分片（PNG 假头藏 MPEG-TS）" },
    s3: { kind: "hls", note: "ljcdn 伪装分片，同 s2" },
    s4: { kind: "direct", headers: "none", note: "xhscdn 直链，带任何 Referer 均 403，不带才 200" },
    final2: { kind: "hls", note: "ljcdn 伪装分片（实测首片 200 image/png）" },
    finale: { kind: "hls", note: "qpic.cn 伪装分片（实测首片 200 image/jpeg）" },
    movie1: { kind: "direct", headers: "none", note: "photovideo 直链，带 Referer 伪装 404，不带才 200" },
    movie2: { kind: "direct", headers: "none", note: "同 movie1" },
    movie3: { kind: "hls", note: "伪装分片（实测 1195 片可下）" },
    chronicle: { kind: "dead", note: "播放列表能取但源片在 rescdn.yishihui.com 已 404（被删除）；若源恢复可改回 hls" },
    sidestory: { kind: "dead", note: "源片在 kwimgs.com 已 404（被删除）；若源恢复可改回 hls" },
    oad: { kind: "dead", note: "/api/parse 直接 HTTP 400，该线路源不被解析器支持" },
    lostgirls: { kind: "dead", note: "同 oad（parse 400）" },
    junior: { kind: "dead", note: "同 oad（parse 400）" },
    cn1: { kind: "dead", note: "国语线路 cn1-cn4 parse 均 HTTP 400（实测）" },
    cn2: { kind: "dead", note: "同 cn1（实测 parse 400）" },
    cn3: { kind: "dead", note: "同 cn1（实测 parse 400）" },
    cn4: { kind: "dead", note: "同 cn1（实测 parse 400）" },
};

/** direct 策略的两组固定请求头。 */
function directHeaders(mode) {
    return mode === "referer" ? PAGE_HEADERS : { "User-Agent": UA };
}

async function downloadEpisode(rec, output) {
    const strategy = SEASON_STRATEGY[rec.seasonKey];
    const bootstrap = await getBootstrap(rec.iframeUrl);
    const videoUrl = await resolveVideoUrl(bootstrap, rec.iframeUrl);
    console.log("  直链：" + videoUrl.slice(0, 80) + "...");
    console.log("  策略：" + strategy.note);

    if (strategy.kind === "hls") {
        // 一致性校验（不是降级）：链路不符就报错交人改表，不自动换方式。
        if (!isHlsUrl(videoUrl)) {
            throw new Error("策略为 hls 但 parse 结果不是播放列表，源线路可能已变，请更新 SEASON_STRATEGY");
        }
        await downloadViaHls(videoUrl, output);
        return;
    }

    // direct：按表固定请求头，一次到底，不试错。
    await downloadFile(videoUrl, output, directHeaders(strategy.headers));
    if (looksLikePlaylist(output)) {
        fs.unlinkSync(output);
        throw new Error("直链下回的内容实为 m3u8，源线路可能已变，请更新 SEASON_STRATEGY");
    }
}

/** 把命令行参数展开成 seasonKey 集合（支持季 key、组名 main/cn/extra、all）。
 *  无参数返回 null（不过滤）；有参数但都没匹配时返回空集合（不下载任何内容）。 */
function resolveSeasonKeys(argv) {
    if (!argv.length) return null;

    const keys = new Set();
    for (const arg of argv) {
        if (arg === "all") {
            Object.keys(CATALOG).forEach((k) => keys.add(k));
        } else if (GROUPS[arg]) {
            GROUPS[arg].forEach((k) => keys.add(k));
        } else if (CATALOG[arg]) {
            keys.add(arg);
        } else {
            console.log("忽略无法识别的参数:", arg);
        }
    }
    return keys;
}

async function main() {
    const seasonKeys = resolveSeasonKeys(process.argv.slice(2));

    let records = loadPlayers();
    if (seasonKeys) {
        records = records.filter((r) => seasonKeys.has(r.seasonKey));
    }

    if (!records.length) {
        console.log("players.json 中没有可下载的集数（先运行 node scratch.js）。");
        return;
    }

    console.log(`共 ${records.length} 集待处理。\n`);

    let success = 0;
    let skipped = 0;
    let failed = 0;
    let declined = 0;

    for (const rec of records) {
        const seasonDir = path.join(OUTPUT_DIR, safeName(rec.seasonName) || "未知季");
        fs.mkdirSync(seasonDir, { recursive: true });

        const name = buildFileName(rec);
        const output = path.join(seasonDir, name);

        console.log(`---------------------------`);
        console.log(`[${rec.seasonName}] 第 ${rec.episode} 集 ${rec.title || ""}`);

        // 按策略表分流：dead 直接跳过（不发解析请求、不重试）；不在表里的 key 不猜。
        const strategy = SEASON_STRATEGY[rec.seasonKey];
        if (!strategy) {
            console.log("  未定义下载策略，跳过（请在 SEASON_STRATEGY 里补充该 key）。");
            declined++;
            continue;
        }
        if (strategy.kind === "dead") {
            console.log(`  线路不可用，跳过：${strategy.note}`);
            declined++;
            continue;
        }

        if (fs.existsSync(output)) {
            if (isValidExisting(output)) {
                console.log("  已完整下载，跳过。");
                skipped++;
                continue;
            }
            // 旧文件或残留的 m3u8 文本等无效文件：删掉重下。
            console.log("  已存在但疑似无效（过小/非视频），重新下载…");
            fs.unlinkSync(output);
        }

        try {
            await withRetry(() => downloadEpisode(rec, output));
            console.log("  下载完成：" + path.relative(__dirname, output));
            success++;
        } catch (error) {
            console.log("  最终失败：" + error.message);
            failed++;
        }

        await sleep(500);
    }

    console.log("\n===========================");
    console.log(`成功 ${success}，跳过 ${skipped}，线路不可用 ${declined}，失败 ${failed}`);
    console.log(`保存目录：${OUTPUT_DIR}`);
}

main().catch((error) => {
    console.error("运行出错：", error);
    process.exit(1);
});
