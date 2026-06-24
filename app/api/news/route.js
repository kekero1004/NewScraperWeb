import { NextResponse } from "next/server";
import { scrapeNaver, scrapeGoogle, scrapeDaum } from "@/lib/scrapers";
import { getCached, setCached } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fetchKeyword(keyword, sources, limit) {
  const cacheKey = `news:${keyword}:${sources.join(",")}:${limit}`;
  const cached = await getCached(cacheKey);
  if (cached) return { articles: cached, cached: true };

  const tasks = [];
  if (sources.includes("naver")) tasks.push(scrapeNaver(keyword, limit));
  if (sources.includes("google")) tasks.push(scrapeGoogle(keyword, limit));
  if (sources.includes("daum")) tasks.push(scrapeDaum(keyword, limit));

  const results = await Promise.all(tasks);
  const articles = results.flat();
  await setCached(cacheKey, articles);
  return { articles, cached: false };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const keywords = (searchParams.get("keywords") || "")
    .split(",").map((k) => k.trim()).filter(Boolean);
  const sources = (searchParams.get("sources") || "naver,google")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const limit = Math.min(Number(searchParams.get("limit")) || 12, 30);

  if (keywords.length === 0) {
    return NextResponse.json({ error: "키워드가 없습니다." }, { status: 400 });
  }

  const settled = await Promise.all(
    keywords.map((k) => fetchKeyword(k, sources, limit))
  );

  const seen = new Set();
  const articles = [];
  for (const { articles: arr } of settled) {
    for (const a of arr) {
      if (a.link && !seen.has(a.link)) {
        seen.add(a.link);
        articles.push(a);
      }
    }
  }

  return NextResponse.json({
    articles,
    count: articles.length,
    cached: settled.some((s) => s.cached),
    fetchedAt: new Date().toISOString(),
  });
}
