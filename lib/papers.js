// 공개(오픈액세스) 논문 검색 레이어.
// API 키가 필요 없는 공개 API만 사용: OpenAlex(메타데이터/초록/OA PDF) + arXiv(프리프린트 PDF).
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

const MAILTO = process.env.OPENALEX_MAILTO || "";

// OpenAlex 의 abstract_inverted_index → 일반 텍스트 복원
function abstractFromInverted(inv) {
  if (!inv || typeof inv !== "object") return "";
  const words = [];
  for (const [word, positions] of Object.entries(inv)) {
    for (const p of positions) words[p] = word;
  }
  return words.join(" ").replace(/\s+/g, " ").trim();
}

function clip(text, max = 600) {
  if (!text) return "";
  const t = String(text).trim();
  return t.length > max ? t.slice(0, max).trimEnd() + "…" : t;
}

// OpenAlex: https://docs.openalex.org/
export async function searchOpenAlex(keyword, limit = 10) {
  try {
    const params = new URLSearchParams({
      search: keyword,
      per_page: String(Math.min(limit, 25)),
      sort: "relevance_score:desc",
    });
    if (MAILTO) params.set("mailto", MAILTO);
    const url = `https://api.openalex.org/works?${params}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.results || []).map((w) => {
      const authors = (w.authorships || [])
        .map((a) => a.author?.display_name)
        .filter(Boolean);
      const pdf =
        w.best_oa_location?.pdf_url ||
        w.open_access?.oa_url ||
        w.primary_location?.pdf_url ||
        null;
      const landing =
        w.primary_location?.landing_page_url ||
        (w.doi ? w.doi : null) ||
        w.id;
      return {
        keyword,
        title: w.display_name || "(제목 없음)",
        authors,
        year: w.publication_year || null,
        venue:
          w.primary_location?.source?.display_name ||
          w.host_venue?.display_name ||
          "",
        abstract: clip(abstractFromInverted(w.abstract_inverted_index)),
        doi: w.doi || null,
        link: landing,
        pdf,
        openAccess: Boolean(w.open_access?.is_oa),
        citations: w.cited_by_count || 0,
        source: "OpenAlex",
      };
    });
  } catch {
    return [];
  }
}

// arXiv Atom API: https://info.arxiv.org/help/api/
export async function searchArxiv(keyword, limit = 10) {
  try {
    const params = new URLSearchParams({
      search_query: `all:${keyword}`,
      start: "0",
      max_results: String(Math.min(limit, 25)),
      sortBy: "relevance",
      sortOrder: "descending",
    });
    const url = `http://export.arxiv.org/api/query?${params}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const xml = await res.text();
    const data = parser.parse(xml);
    let entries = data?.feed?.entry || [];
    if (!Array.isArray(entries)) entries = [entries];
    return entries.map((e) => {
      let authors = e.author || [];
      if (!Array.isArray(authors)) authors = [authors];
      const names = authors.map((a) => a?.name).filter(Boolean);
      let links = e.link || [];
      if (!Array.isArray(links)) links = [links];
      const pdfLink = links.find((l) => l["@_title"] === "pdf")?.["@_href"];
      const absLink =
        links.find((l) => l["@_rel"] === "alternate")?.["@_href"] || e.id;
      const year = e.published ? new Date(e.published).getFullYear() : null;
      return {
        keyword,
        title: String(e.title || "(제목 없음)").replace(/\s+/g, " ").trim(),
        authors: names,
        year: Number.isNaN(year) ? null : year,
        venue: "arXiv",
        abstract: clip(String(e.summary || "").replace(/\s+/g, " ").trim()),
        doi: e["arxiv:doi"] || null,
        link: absLink,
        pdf: pdfLink || null,
        openAccess: true,
        citations: 0,
        source: "arXiv",
      };
    });
  } catch {
    return [];
  }
}

// 한 키워드에 대해 여러 소스를 병합하고 링크 기준으로 중복 제거
export async function searchPapers(keyword, sources, limit = 10) {
  const tasks = [];
  if (sources.includes("openalex")) tasks.push(searchOpenAlex(keyword, limit));
  if (sources.includes("arxiv")) tasks.push(searchArxiv(keyword, limit));
  const results = await Promise.all(tasks);
  const merged = results.flat();

  const seen = new Set();
  const out = [];
  for (const p of merged) {
    const key = (p.doi || p.link || p.title || "").toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }
  // 인용수 우선, 그다음 최신순
  out.sort((a, b) => (b.citations - a.citations) || ((b.year || 0) - (a.year || 0)));
  return out;
}
