import { NextResponse } from "next/server";
import { getTrendKeywords } from "@/lib/trends";
import { getCached, setCached } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cacheKey = "trends:KR";
  const cached = await getCached(cacheKey);
  if (cached) return NextResponse.json({ keywords: cached, cached: true });

  const keywords = await getTrendKeywords(10);
  await setCached(cacheKey, keywords);
  return NextResponse.json({ keywords, cached: false });
}
