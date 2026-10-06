const fs = require("fs");
const path = require("path");
const axios = require("axios");

// 从 players.json 读取每一集的播放器信息，
// 逐个解析出真实视频直链，再下载保存为「第XX集.mp4」。

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";

const OUTPUT_DIR = path.join(__dirname, "videos");

// 解析请求头：模拟浏览器从播放页发起，Referer/Origin 指向播放器域名。
const PAGE_HEADERS = {
    "User-Agent": UA,
    Accept: "*/*",
    Referer: "https://dm84.tv/",
};

/**
 * 读取 players.json
 */
function loadPlayers() {
    const file = path.join(__dirname, "players.json");
    const list = JSON.parse(fs.readFileSync(file, "utf8"));

    // 只保留成功解析出播放器信息的集数，跳过带 error 的集。
    return list.filter((item) => item.iframeUrl && !item.error);
}

/**
 * 打开 iframe 播放页，提取 window.__HHJX_BOOTSTRAP__ 引导参数。
 */
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

/**
 * 调用播放器解析接口，把引导参数换成真实视频直链。
 */
async function resolveVideoUrl(bootstrap, iframeUrl) {
    const origin = new URL(iframeUrl).origin;

    const body = {
        url: bootstrap.url,
        t: bootstrap.t,
        key: bootstrap.key,
    };

    if (bootstrap.act === 99) {
        body.act = 99;
    }

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

    // 播放器有时返回 http 直链，统一升级成 https 再下载。
    return String(res.data.url).replace(/^http:\/\//i, "https://");
}

/**
 * 下载单个视频，带进度显示，支持重定向跟随。
 *
 * 为避免把网络中断的半当成「已完成」，先写入 .part 临时文件，
 * 只有在字节数与 content-length 一致后才重命名为最终的 .mp4。
 */
async function downloadFile(videoUrl, output) {
    const partPath = output + ".part";

    try {
        const res = await axios.get(videoUrl, {
            headers: PAGE_HEADERS,
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

        // 校验完整性：已知总大小时，落地文件必须与之一致。
        if (total) {
            const actual = fs.statSync(partPath).size;

            if (actual !== total) {
                throw new Error(
                    `下载不完整（${actual}/${total} 字节），将重试`
                );
            }
        }

        // 只有成功下载且校验通过后，才改名为正式文件名。
        fs.renameSync(partPath, output);
    } catch (error) {
        process.stdout.write("\n");

        // 出错的半成品文件一律删除，避免被误判为已完成。
        if (fs.existsSync(partPath)) {
            fs.unlinkSync(partPath);
        }

        throw error;
    }
}

/** 集数补零，例如 1 -> 01，25 -> 25。 */
function formatEpisode(episode) {
    return String(episode).padStart(2, "0");
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带指数退避的重试包装，用于应对 TLS 断连、连接超时等瞬时网络错误。
 */
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

/**
 * 解析并下载单集：引导参数 -> 真实直链 -> 下载落地。
 */
async function downloadEpisode(item, output) {
    const bootstrap = await getBootstrap(item.iframeUrl);
    const videoUrl = await resolveVideoUrl(bootstrap, item.iframeUrl);

    console.log("  直链：" + videoUrl.slice(0, 80) + "...");

    await downloadFile(videoUrl, output);
}

async function main() {
    // 支持可选命令行参数：node downloadVideo.js [起始集] [结束集]
    const [startArg, endArg] = process.argv.slice(2);
    const start = startArg ? Number(startArg) : 1;
    const end = endArg ? Number(endArg) : Infinity;

    const episodes = loadPlayers().filter(
        (item) => item.episode >= start && item.episode <= end
    );

    if (!episodes.length) {
        console.log("players.json 中没有可下载的集数。");
        return;
    }

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    console.log(`共 ${episodes.length} 集待处理。\n`);

    let success = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of episodes) {
        const name = `第${formatEpisode(item.episode)}集.mp4`;
        const output = path.join(OUTPUT_DIR, name);

        console.log(`---------------------------`);
        console.log(`第 ${item.episode} 集`);

        if (fs.existsSync(output)) {
            console.log("  已完整下载，跳过。");
            skipped++;
            continue;
        }

        try {
            await withRetry(() => downloadEpisode(item, output));

            console.log("  下载完成：" + name);
            success++;
        } catch (error) {
            console.log("  最终失败：" + error.message);
            failed++;
        }

        // 集与集之间稍作间隔，避免请求过于密集。
        await sleep(500);
    }

    console.log("\n===========================");
    console.log(`成功 ${success}，跳过 ${skipped}，失败 ${failed}`);
    console.log(`保存目录：${OUTPUT_DIR}`);
}

main().catch((error) => {
    console.error("运行出错：", error);
    process.exit(1);
});
