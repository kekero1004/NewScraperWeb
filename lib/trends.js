import { XMLParser } from "fast-xml-parser";
import { scrapeNaver } from "./scrapers";

const parser = new XMLParser();

const DEFAULT_TRENDS = [
  "인공지능", "반도체", "전기차", "부동산", "금리",
  "ChatGPT", "로봇", "우주항공", "방산", "수소",
];

const STOPWORDS = new Set([
  "기자", "단독", "속보", "종합", "그", "이", "저", "및", "등", "위해", "관련",
]);

// 1) 구글 트렌드 일별 인기 검색어(한국) → 2) 네이버 카테고리 추출 → 3) 기본값
export async function getTrendKeywords(limit = 10) {
  // 1) Google Trends RSS
  try {
    const res = await fetch(
      "https://trends.google.com/trending/rss?geo=KR",
      { cache: "no-store" }
    );
    if (res.ok) {
      const xml = await res.text();
      const data = parser.parse(xml);
      let items = data?.rss?.channel?.item || [];
      if (!Array.isArray(items)) items = [items];
      const kws = items
        .map((it) => String(it.title || "").trim())
        .filter(Boolean);
      if (kws.length) return [...new Set(kws)].slice(0, limit);
    }
  } catch {
    /* 다음 단계로 */
  }

  // 2) 네이버 카테고리 기사 제목에서 키워드 추출
  try {
    const categories = ["뉴스", "경제", "사회", "기술", "산업"];
    const collected = [];
    for (const cat of categories) {
      const items = await scrapeNaver(cat, 3);
      for (const it of items) {
        const words = it.title.split(/\s+/);
        for (const w of words.slice(0, 2)) {
          const clean = w.replace(/[^\uAC00-\uD7A3a-zA-Z0-9]/g, "");
          if (clean.length > 1 && !STOPWORDS.has(clean) && !collected.includes(clean)) {
            collected.push(clean);
          }
        }
      }
    }
    if (collected.length) return collected.slice(0, limit);
  } catch {
    /* 폴백 */
  }

  // 3) 기본값
  return DEFAULT_TRENDS.slice(0, limit);
}
