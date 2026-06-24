import { XMLParser } from "fast-xml-parser";
import * as cheerio from "cheerio";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

function cleanTitle(title, source) {
  if (!title) return "";
  let t = String(title).replace(/<\/?b>/g, "").trim();
  if (source) t = t.replace(new RegExp(`\\s*-\\s*${source}\\s*$`), "");
  return t;
}

// 네이버 검색 API (서버에서만 시크릿 사용)
export async function scrapeNaver(keyword, limit = 15) {
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) return [];
  try {
    const url =
      `https://openapi.naver.com/v1/search/news.json` +
      `?query=${encodeURIComponent(keyword)}&display=${limit}&sort=date`;
    const res = await fetch(url, {
      headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.items || []).map((it) => ({
      keyword,
      title: cleanTitle(it.title),
      link: it.link,
      source: it.originallink || "네이버",
      pubDate: it.pubDate || "",
    }));
  } catch {
    return [];
  }
}

// 구글 뉴스 RSS
export async function scrapeGoogle(keyword, limit = 15) {
  try {
    const url =
      `https://news.google.com/rss/search` +
      `?q=${encodeURIComponent(keyword)}&hl=ko&gl=KR&ceid=KR:ko`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const xml = await res.text();
    const data = parser.parse(xml);
    let items = data?.rss?.channel?.item || [];
    if (!Array.isArray(items)) items = [items];
    return items.slice(0, limit).map((it) => {
      const source =
        typeof it.source === "object" ? it.source["#text"] : it.source;
      return {
        keyword,
        title: cleanTitle(it.title, source),
        link: it.link,
        source: source || "Google News",
        pubDate: it.pubDate || "",
      };
    });
  } catch {
    return [];
  }
}

// 다음 뉴스 (실험적: 마크업이 자주 바뀌므로 셀렉터 점검 필요)
export async function scrapeDaum(keyword, limit = 10) {
  try {
    const url = `https://search.daum.net/search?w=news&q=${encodeURIComponent(
      keyword
    )}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const out = [];
    const selectors = ["a.f_link_b", "a.tit_main", "ul.list_news li a.tit"];
    for (const sel of selectors) {
      $(sel).each((_, el) => {
        const title = $(el).text().trim();
        const link = $(el).attr("href");
        if (title && link)
          out.push({ keyword, title, link, source: "다음", pubDate: "" });
      });
      if (out.length) break;
    }
    return out.slice(0, limit);
  } catch {
    return [];
  }
}
