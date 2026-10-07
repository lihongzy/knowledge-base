// 《进击的巨人》条目清单，供 scratch.js（解析）与 downloadVideo.js（下载）共用。
// line = 1 是站点默认线路，走 hhjx 播放器，可被 downloadVideo.js 解析下载。

const BASE_URL = "https://dm84.tv";

const CATALOG = {
    // —— 日配主线 ——
    s1: { key: "s1", group: "main", name: "第一季", detailUrl: "/v/72.html", line: 1 },
    s2: { key: "s2", group: "main", name: "第二季", detailUrl: "/v/73.html", line: 1 },
    s3: { key: "s3", group: "main", name: "第三季", detailUrl: "/v/74.html", line: 1 },
    s4: { key: "s4", group: "main", name: "第四季", detailUrl: "/v/75.html", line: 1 },
    final2: { key: "final2", group: "main", name: "最终季Part2", detailUrl: "/v/1397.html", line: 1 },
    finale: { key: "finale", group: "main", name: "最终季完结篇", detailUrl: "/v/3811.html", line: 1 },

    // —— 国语版 ——
    cn1: { key: "cn1", group: "cn", name: "第一季国语", detailUrl: "/v/3081.html", line: 1 },
    cn2: { key: "cn2", group: "cn", name: "第二季国语", detailUrl: "/v/3082.html", line: 1 },
    cn3: { key: "cn3", group: "cn", name: "第三季国语", detailUrl: "/v/3083.html", line: 1 },
    cn4: { key: "cn4", group: "cn", name: "第四季国语", detailUrl: "/v/3084.html", line: 1 },

    // —— 剧场版 / OAD / 外传 / 衍生 ——
    movie1: { key: "movie1", group: "extra", name: "剧场版红莲之箭", detailUrl: "/v/2189.html", line: 1 },
    movie2: { key: "movie2", group: "extra", name: "剧场版自由之翼", detailUrl: "/v/2188.html", line: 1 },
    movie3: { key: "movie3", group: "extra", name: "剧场版觉醒的咆哮", detailUrl: "/v/2185.html", line: 1 },
    chronicle: { key: "chronicle", group: "extra", name: "编年史", detailUrl: "/v/2190.html", line: 1 },
    oad: { key: "oad", group: "extra", name: "OAD", detailUrl: "/v/2187.html", line: 1 },
    sidestory: { key: "sidestory", group: "extra", name: "外传无悔的选择", detailUrl: "/v/2184.html", line: 1 },
    lostgirls: { key: "lostgirls", group: "extra", name: "LOST GIRLS", detailUrl: "/v/2186.html", line: 1 },
    junior: { key: "junior", group: "extra", name: "进击巨人中学", detailUrl: "/v/1170.html", line: 1 },
};

const GROUPS = {
    main: ["s1", "s2", "s3", "s4", "final2", "finale"],
    cn: ["cn1", "cn2", "cn3", "cn4"],
    extra: [
        "movie1", "movie2", "movie3", "chronicle",
        "oad", "sidestory", "lostgirls", "junior",
    ],
};

module.exports = { BASE_URL, CATALOG, GROUPS };
