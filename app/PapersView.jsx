"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Search, Loader2, X, Download, FileText, ExternalLink, Plus, Hash,
  Layers, ChevronRight, RefreshCw, GraduationCap, Sparkles, FileDown,
  CheckSquare, Square, Quote, Database,
} from "lucide-react";
import ModeTabs from "./ModeTabs";

const DEFAULT_KEYWORDS = "BIM, digital twin, smart construction";
const SUGGESTED = [
  "machine learning", "GIS", "remote sensing", "structural health monitoring",
  "BIM", "digital twin", "LiDAR", "deep learning", "water resources", "autonomous driving",
];

function download(name, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// 아주 단순한 마크다운 → HTML (제목/불릿/굵게/링크) — PDF 인쇄 미리보기용
function miniMarkdownToHtml(md) {
  return escapeHtml(md)
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/^\s*[-*] (.*)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\n{2,}/g, "<br/><br/>");
}

export default function PapersView({ mode, setMode }) {
  const [input, setInput] = useState(DEFAULT_KEYWORDS);
  const [sources, setSources] = useState({ openalex: true, arxiv: true });
  const [papers, setPapers] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [activeKeyword, setActiveKeyword] = useState("전체");
  const [summaries, setSummaries] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const runSearch = useCallback(async (kwString) => {
    const raw = kwString ?? input;
    const keywords = raw.split(",").map((k) => k.trim()).filter(Boolean);
    if (!keywords.length) { setError("키워드를 입력하세요."); return; }
    const srcList = Object.entries(sources).filter(([, v]) => v).map(([k]) => k);
    if (!srcList.length) { setError("소스를 1개 이상 선택하세요."); return; }

    setLoading(true); setError(""); setSelected(new Set());
    setSearched(true); setActiveKeyword("전체"); setSummaries([]);
    try {
      const qs = new URLSearchParams({
        keywords: keywords.join(","),
        sources: srcList.join(","),
        limit: "10",
      });
      const res = await fetch(`/api/papers?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "요청 실패");
      const withId = data.papers.map((p, i) => ({ ...p, id: `${p.keyword}|${p.link || p.title}|${i}` }));
      setPapers(withId);
      setFromCache(!!data.cached);
      if (!withId.length) setError("결과가 없습니다. 영문 키워드로 시도하면 결과가 더 많습니다.");
    } catch (e) {
      setError(`논문을 가져오지 못했습니다: ${e.message}`);
    } finally { setLoading(false); }
  }, [input, sources]);

  const addKeyword = (kw) => {
    const cur = input.split(",").map((k) => k.trim()).filter(Boolean);
    if (!cur.includes(kw)) setInput([...cur, kw].join(", "));
  };

  const keywordCounts = papers.reduce((acc, p) => {
    acc[p.keyword] = (acc[p.keyword] || 0) + 1; return acc;
  }, {});
  const keywordMenu = Object.keys(keywordCounts);

  const filtered = activeKeyword === "전체"
    ? papers
    : papers.filter((p) => p.keyword === activeKeyword);
  const groups = filtered.reduce((acc, p) => {
    (acc[p.keyword] = acc[p.keyword] || []).push(p); return acc;
  }, {});

  useEffect(() => {
    if (activeKeyword !== "전체" && !keywordMenu.includes(activeKeyword)) {
      setActiveKeyword("전체");
    }
  }, [activeKeyword, keywordMenu]);

  const toggleSelect = (id) =>
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () => {
    if (selected.size >= filtered.length && filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((p) => p.id)));
  };
  const selectedPapers = papers.filter((p) => selected.has(p.id));

  // 선택 없으면 화면에 보이는(필터된) 논문 전체를 대상으로
  const targetPapers = selectedPapers.length ? selectedPapers : filtered;

  const summarize = async () => {
    if (!targetPapers.length) { setError("요약할 논문이 없습니다."); return; }
    setSummaryLoading(true); setError("");
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ papers: targetPapers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "요약 실패");
      setSummaries(data.summaries || []);
    } catch (e) {
      setError(`요약에 실패했습니다: ${e.message}`);
    } finally { setSummaryLoading(false); }
  };

  // ---- 내보내기 (마크다운 / PDF) ----
  function buildMarkdown() {
    const date = new Date().toLocaleString("ko-KR");
    let md = `# 논문 Auto-Research 리포트\n\n생성일: ${date}\n\n`;

    if (summaries.length) {
      md += `## 키워드별 요약\n\n`;
      for (const s of summaries) {
        md += `### 🔑 ${s.keyword} (${s.count}건)\n\n${s.summary}\n\n`;
      }
    }

    md += `## 논문 목록\n\n`;
    const byKw = targetPapers.reduce((acc, p) => {
      (acc[p.keyword] = acc[p.keyword] || []).push(p); return acc;
    }, {});
    for (const [kw, items] of Object.entries(byKw)) {
      md += `### 🔍 ${kw}\n\n`;
      items.forEach((p, i) => {
        const authors = (p.authors || []).slice(0, 5).join(", ");
        md += `${i + 1}. **${p.title}**\n`;
        if (authors) md += `   - 저자: ${authors}${(p.authors || []).length > 5 ? " 외" : ""}\n`;
        md += `   - 연도/출처: ${p.year || "?"} · ${p.venue || p.source}${p.citations ? ` · 인용 ${p.citations}` : ""}\n`;
        if (p.abstract) md += `   - 초록: ${p.abstract}\n`;
        if (p.link) md += `   - 원문: ${p.link}\n`;
        if (p.pdf) md += `   - PDF: ${p.pdf}\n`;
        md += `\n`;
      });
    }
    return md;
  }

  const exportMarkdown = () => {
    if (!targetPapers.length) { setError("내보낼 논문이 없습니다."); return; }
    download(`papers_${Date.now()}.md`, buildMarkdown(), "text/markdown;charset=utf-8");
  };

  const exportPDF = () => {
    if (!targetPapers.length) { setError("내보낼 논문이 없습니다."); return; }
    const html = miniMarkdownToHtml(buildMarkdown());
    const doc =
      `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>논문 리포트</title>` +
      `<style>body{font-family:'Segoe UI','Malgun Gothic',sans-serif;max-width:800px;margin:40px auto;padding:0 24px;color:#1f2937;line-height:1.6}` +
      `h1{border-bottom:2px solid #3b82f6;padding-bottom:8px}h2{margin-top:28px;color:#1d4ed8}h3{margin-top:18px;color:#334155}` +
      `a{color:#1d4ed8;word-break:break-all}ul{padding-left:18px}li{margin-bottom:4px}</style>` +
      `<script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script></head>` +
      `<body>${html}</body></html>`;
    // document.write 대신 Blob URL 로 새 창을 열고, 로드 후 인쇄(사용자가 "PDF로 저장")
    const url = URL.createObjectURL(new Blob([doc], { type: "text/html" }));
    const win = window.open(url, "_blank");
    if (!win) { setError("팝업이 차단되었습니다. PDF 저장을 위해 팝업을 허용해 주세요."); URL.revokeObjectURL(url); return; }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return (
    <>
      {/* 좌측 사이드바 */}
      <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0">
        <ModeTabs mode={mode} setMode={setMode} />

        <div className="px-4 pt-4 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
          <Layers size={13} /> 검색 키워드
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
          {keywordMenu.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">
              검색하면 키워드가<br />여기에 표시됩니다.
            </p>
          ) : (
            <>
              <button
                onClick={() => setActiveKeyword("전체")}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                  activeKeyword === "전체" ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-600 hover:bg-slate-50"
                }`}>
                <Layers size={15} className={activeKeyword === "전체" ? "text-blue-600" : "text-slate-400"} />
                <span className="flex-1 text-left">전체</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeKeyword === "전체" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>{papers.length}</span>
              </button>
              {keywordMenu.map((kw) => {
                const on = activeKeyword === kw;
                return (
                  <button key={kw} onClick={() => setActiveKeyword(kw)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                      on ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-600 hover:bg-slate-50"
                    }`}>
                    <Hash size={15} className={on ? "text-blue-600" : "text-slate-400"} />
                    <span className="flex-1 text-left truncate">{kw}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${on ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>{keywordCounts[kw]}</span>
                    {on && <ChevronRight size={14} className="text-blue-500" />}
                  </button>
                );
              })}
            </>
          )}
        </nav>
      </aside>

      {/* 우측 메인 */}
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <div className="max-w-5xl mx-auto px-4 py-6">

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !loading && runSearch()}
                  placeholder="콤마로 구분하여 키워드 입력 (영문 권장, 예: BIM, digital twin)"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                />
              </div>
              <button onClick={() => runSearch()} disabled={loading}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-medium text-sm flex items-center gap-2 transition">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                {loading ? "검색 중" : "논문 검색"}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-3">
              <div className="flex gap-3">
                {[["openalex", "OpenAlex (전 분야)"], ["arxiv", "arXiv (프리프린트)"]].map(([k, label]) => (
                  <label key={k} className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={sources[k]}
                      onChange={(e) => setSources((s) => ({ ...s, [k]: e.target.checked }))}
                      className="accent-blue-600" />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 mt-3">
              <span className="text-xs text-slate-400 self-center mr-1">추천:</span>
              {SUGGESTED.map((kw) => (
                <button key={kw} onClick={() => addKeyword(kw)}
                  className="text-xs px-2.5 py-1 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 transition flex items-center gap-1">
                  <Plus size={11} /> {kw}
                </button>
              ))}
            </div>
          </div>

          {searched && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <button onClick={toggleSelectAll}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 flex items-center gap-1">
                {selected.size >= filtered.length && filtered.length
                  ? <><CheckSquare size={15} /> 전체 해제</> : <><Square size={15} /> 전체 선택</>}
              </button>
              <button onClick={summarize} disabled={summaryLoading || !targetPapers.length}
                className="px-3 py-1.5 text-sm bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white rounded-lg flex items-center gap-1.5">
                {summaryLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                키워드별 요약 {selected.size ? `(${selectedPapers.length})` : ""}
              </button>
              <button onClick={exportMarkdown} disabled={!targetPapers.length}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1.5">
                <FileText size={15} /> Markdown
              </button>
              <button onClick={exportPDF} disabled={!targetPapers.length}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1.5">
                <FileDown size={15} /> PDF
              </button>
              <div className="ml-auto flex items-center gap-2 text-sm text-slate-400">
                {fromCache && <span className="flex items-center gap-1 text-emerald-600"><Database size={13} /> 캐시</span>}
                <span>{filtered.length}건</span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 mb-4 text-sm flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => runSearch()} className="flex items-center gap-1 text-amber-700 hover:text-amber-900"><RefreshCw size={14} /> 다시 시도</button>
            </div>
          )}

          {/* 요약 결과 */}
          {summaries.length > 0 && (
            <div className="mb-6 space-y-3">
              {summaries.map((s) => (
                <div key={s.keyword} className="bg-violet-50 border border-violet-200 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={16} className="text-violet-600" />
                    <h3 className="font-semibold text-violet-900">{s.keyword} 요약</h3>
                    <span className="text-xs text-violet-500 bg-violet-100 px-2 py-0.5 rounded-full">{s.count}건</span>
                    <span className="text-[10px] text-violet-400 ml-auto">{s.method === "llm" ? "AI 요약" : "추출 요약"}</span>
                  </div>
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{s.summary}</pre>
                </div>
              ))}
            </div>
          )}

          {loading && (
            <div className="text-center py-16 text-slate-400">
              <Loader2 size={32} className="animate-spin mx-auto mb-3" />
              <p className="text-sm">논문을 검색하는 중...</p>
            </div>
          )}

          {!loading && searched && filtered.length === 0 && !error && (
            <div className="text-center py-16 text-slate-400">
              <GraduationCap size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">표시할 논문이 없습니다.</p>
            </div>
          )}

          {!loading && Object.entries(groups).map(([keyword, items]) => (
            <div key={keyword} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="font-semibold text-slate-800">🔍 {keyword}</h2>
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{items.length}건</span>
              </div>
              <div className="space-y-3">
                {items.map((p) => {
                  const isSel = selected.has(p.id);
                  return (
                    <div key={p.id} onClick={() => toggleSelect(p.id)}
                      className={`bg-white rounded-xl border p-4 cursor-pointer transition hover:shadow-md ${isSel ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200"}`}>
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 ${isSel ? "text-blue-600" : "text-slate-300"}`}>{isSel ? <CheckSquare size={18} /> : <Square size={18} />}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 leading-snug">{p.title}</p>
                          {(p.authors || []).length > 0 && (
                            <p className="text-xs text-slate-500 mt-1 truncate">
                              {p.authors.slice(0, 4).join(", ")}{p.authors.length > 4 ? " 외" : ""}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs text-slate-400">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{p.source}</span>
                            {p.year && <span>{p.year}</span>}
                            {p.venue && <><span>·</span><span className="truncate max-w-[200px]">{p.venue}</span></>}
                            {p.citations > 0 && <><span>·</span><span className="flex items-center gap-0.5"><Quote size={11} /> {p.citations}</span></>}
                          </div>
                          {p.abstract && (
                            <p className="text-xs text-slate-600 mt-2 leading-relaxed line-clamp-3">{p.abstract}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2.5" onClick={(e) => e.stopPropagation()}>
                            {p.link && (
                              <a href={p.link} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                                원문 보기 <ExternalLink size={11} />
                              </a>
                            )}
                            {p.pdf && (
                              <a href={p.pdf} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-800">
                                <Download size={12} /> PDF 다운로드
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {!searched && !loading && (
            <div className="text-center py-16 text-slate-400">
              <GraduationCap size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">키워드를 입력하고 공개 논문을 검색해 보세요</p>
              <p className="text-xs mt-1 text-slate-300">OpenAlex · arXiv 기반 · 영문 키워드 권장</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
