import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---- 추출 요약 폴백 (LLM 키가 없을 때) ----
function splitSentences(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?。])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

function extractiveSummary(papers, keyword) {
  // 키워드 그룹의 모든 초록 문장을 단어 빈도로 점수화하여 상위 문장 선택
  const sentences = [];
  for (const p of papers) {
    for (const s of splitSentences(p.abstract)) sentences.push({ s, title: p.title });
  }
  if (sentences.length === 0) {
    return `"${keyword}" 관련 논문 ${papers.length}건을 찾았으나 요약할 초록 정보가 부족합니다.`;
  }
  const freq = {};
  for (const { s } of sentences) {
    for (const w of s.toLowerCase().match(/[a-z가-힣0-9]{3,}/g) || []) {
      freq[w] = (freq[w] || 0) + 1;
    }
  }
  const scored = sentences.map((item, i) => {
    const words = item.s.toLowerCase().match(/[a-z가-힣0-9]{3,}/g) || [];
    const score = words.reduce((acc, w) => acc + (freq[w] || 0), 0) / (words.length || 1);
    return { ...item, score, i };
  });
  const top = scored.sort((a, b) => b.score - a.score).slice(0, 5).sort((a, b) => a.i - b.i);
  const body = top.map((t) => `- ${t.s}`).join("\n");
  return `"${keyword}" 관련 논문 ${papers.length}건의 핵심 내용 요약:\n\n${body}`;
}

// ---- Claude API 요약 (ANTHROPIC_API_KEY 있을 때) ----
async function llmSummary(papers, keyword, apiKey) {
  const list = papers
    .map((p, i) => {
      const authors = (p.authors || []).slice(0, 3).join(", ");
      return `${i + 1}. 제목: ${p.title}\n   저자: ${authors}${(p.authors || []).length > 3 ? " 외" : ""}\n   연도: ${p.year || "?"} / 출처: ${p.venue || p.source}\n   초록: ${p.abstract || "(없음)"}`;
    })
    .join("\n\n");

  const prompt =
    `다음은 "${keyword}" 주제로 검색된 학술 논문 목록입니다. ` +
    `이 논문들을 종합하여 한국어로 정리해 주세요.\n\n` +
    `1) 이 주제의 연구 동향을 3~5문장으로 요약\n` +
    `2) 주요 논문별 핵심 기여를 한 줄씩 (불릿)\n` +
    `마크다운 형식으로 작성하세요.\n\n${list}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`LLM 요청 실패 (${res.status})`);
  }
  const json = await res.json();
  return (json.content || []).map((c) => c.text).join("").trim();
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const papers = Array.isArray(body?.papers) ? body.papers : [];
  if (papers.length === 0) {
    return NextResponse.json({ error: "요약할 논문이 없습니다." }, { status: 400 });
  }

  // 키워드별 그룹화
  const groups = {};
  for (const p of papers) {
    const k = p.keyword || "기타";
    (groups[k] = groups[k] || []).push(p);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const summaries = [];
  for (const [keyword, items] of Object.entries(groups)) {
    let summary;
    let method = "extractive";
    if (apiKey) {
      try {
        summary = await llmSummary(items, keyword, apiKey);
        method = "llm";
      } catch {
        summary = extractiveSummary(items, keyword);
      }
    } else {
      summary = extractiveSummary(items, keyword);
    }
    summaries.push({ keyword, count: items.length, summary, method });
  }

  return NextResponse.json({ summaries, llm: Boolean(apiKey) });
}
