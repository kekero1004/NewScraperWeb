import { NextResponse } from "next/server";
import { searchPapers } from "@/lib/papers";
import { getCached, setCached } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fetchKeyword(keyword, sources, limit) {
  const cacheKey = `papers:${keyword}:${sources.join(",")}:${limit}`;
  const cached = await getCached(cacheKey);
  if (cached) return { papers: cached, cached: true };

  const papers = await searchPapers(keyword, sources, limit);
  await setCached(cacheKey, papers);
  return { papers, cached: false };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const keywords = (searchParams.get("keywords") || "")
    .split(",").map((k) => k.trim()).filter(Boolean);
  const sources = (searchParams.get("sources") || "openalex,arxiv")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const limit = Math.min(Number(searchParams.get("limit")) || 10, 25);

  if (keywords.length === 0) {
    return NextResponse.json({ error: "키워드가 없습니다." }, { status: 400 });
  }
  if (sources.length === 0) {
    return NextResponse.json({ error: "소스를 1개 이상 선택하세요." }, { status: 400 });
  }

  const settled = await Promise.all(
    keywords.map((k) => fetchKeyword(k, sources, limit))
  );

  const seen = new Set();
  const papers = [];
  for (const { papers: arr } of settled) {
    for (const p of arr) {
      const key = (p.doi || p.link || p.title || "").toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        papers.push(p);
      }
    }
  }

  return NextResponse.json({
    papers,
    count: papers.length,
    cached: settled.some((s) => s.cached),
    fetchedAt: new Date().toISOString(),
  });
}
