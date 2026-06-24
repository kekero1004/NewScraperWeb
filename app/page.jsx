"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Search, LayoutGrid, List, CheckSquare, Square, Download,
  ExternalLink, Loader2, X, Newspaper, FileText, Mail, Plus,
  RefreshCw, Database, Flame, Send, Hash, ChevronRight, Layers,
} from "lucide-react";

const DEFAULT_KEYWORDS = "BIM, 스마트건설, 디지털트윈, 드론, 수자원, AI 건설";
const SUGGESTED = ["공간정보", "GIS", "측량", "하천", "방재", "로봇", "양자컴퓨터", "자율주행", "스마트안전", "도로", "철도", "상하수도"];
const CATEGORY_MAP = {
  기술: ["AI", "인공지능", "BIM", "디지털트윈", "로봇", "드론", "양자", "자율주행", "스마트"],
  건설: ["건설", "도로", "철도", "교량", "터널", "스마트건설", "수자원", "하천", "상하수도", "측량", "공간정보"],
  경제: ["경제", "금융", "주식", "투자", "부동산", "산업"],
  안전: ["안전", "방재", "재난", "재해"],
};

function timeAgo(s) {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}일 전`;
  return d.toLocaleDateString("ko-KR");
}
function withinDays(s, days) {
  if (days === 0 || !s) return true;
  const d = new Date(s);
  if (isNaN(d.getTime())) return true;
  return Date.now() - d.getTime() <= days * 86400000;
}
function download(name, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [input, setInput] = useState(DEFAULT_KEYWORDS);
  const [sources, setSources] = useState({ naver: true, google: true, daum: false });
  const [articles, setArticles] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [view, setView] = useState("card");
  const [category, setCategory] = useState("전체");
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [trendLoading, setTrendLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [activeKeyword, setActiveKeyword] = useState("전체");

  const runSearch = useCallback(async (kwString) => {
    const raw = kwString ?? input;
    const keywords = raw.split(",").map((k) => k.trim()).filter(Boolean);
    if (!keywords.length) { setError("키워드를 입력하세요."); return; }
    const srcList = Object.entries(sources).filter(([, v]) => v).map(([k]) => k);
    if (!srcList.length) { setError("소스를 1개 이상 선택하세요."); return; }

    setLoading(true); setError(""); setSelected(new Set()); setSearched(true); setActiveKeyword("전체");
    try {
      const qs = new URLSearchParams({
        keywords: keywords.join(","),
        sources: srcList.join(","),
        limit: "12",
      });
      const res = await fetch(`/api/news?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "요청 실패");
      const withId = data.articles.map((a, i) => ({ ...a, id: `${a.keyword}|${a.link}|${i}` }));
      setArticles(withId);
      setFromCache(!!data.cached);
      if (!withId.length) setError("결과가 없습니다. 다른 키워드나 소스를 시도해 보세요.");
    } catch (e) {
      setError(`뉴스를 가져오지 못했습니다: ${e.message}`);
    } finally { setLoading(false); }
  }, [input, sources]);

  const loadTrends = async () => {
    setTrendLoading(true); setError("");
    try {
      const res = await fetch("/api/trends");
      const data = await res.json();
      if (data.keywords?.length) {
        const s = data.keywords.join(", ");
        setInput(s);
        await runSearch(s);
      } else setError("트렌드 키워드를 가져오지 못했습니다.");
    } catch {
      setError("트렌드 키워드를 가져오지 못했습니다.");
    } finally { setTrendLoading(false); }
  };

  const addKeyword = (kw) => {
    const cur = input.split(",").map((k) => k.trim()).filter(Boolean);
    if (!cur.includes(kw)) setInput([...cur, kw].join(", "));
  };

  // 날짜 + 카테고리 필터 (사이드바 키워드 목록/카운트의 기준)
  const scoped = articles.filter((a) => {
    if (!withinDays(a.pubDate, days)) return false;
    if (category === "전체") return true;
    const terms = CATEGORY_MAP[category] || [];
    const hay = `${a.keyword} ${a.title}`.toLowerCase();
    return terms.some((t) => hay.includes(t.toLowerCase()));
  });

  // 사이드바 메뉴: 검색된 키워드별 건수
  const keywordCounts = scoped.reduce((acc, a) => {
    acc[a.keyword] = (acc[a.keyword] || 0) + 1; return acc;
  }, {});
  const keywordMenu = Object.keys(keywordCounts);

  // 선택된 키워드 기준으로 표시할 기사
  const filtered = activeKeyword === "전체"
    ? scoped
    : scoped.filter((a) => a.keyword === activeKeyword);
  const groups = filtered.reduce((acc, a) => {
    (acc[a.keyword] = acc[a.keyword] || []).push(a); return acc;
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
    else setSelected(new Set(filtered.map((a) => a.id)));
  };
  const selectedArticles = articles.filter((a) => selected.has(a.id));

  const exportCSV = () => {
    const rows = [["키워드", "제목", "출처", "날짜", "링크"]];
    selectedArticles.forEach((a) => rows.push([a.keyword, a.title, a.source, a.pubDate, a.link]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    download(`news_${Date.now()}.csv`, "\uFEFF" + csv, "text/csv;charset=utf-8");
  };
  const exportHTML = () => {
    const items = selectedArticles.map((a) =>
      `<li style="margin-bottom:14px"><a href="${a.link}" target="_blank" style="font-size:16px;font-weight:600;color:#1d4ed8;text-decoration:none">${a.title}</a><div style="font-size:12px;color:#6b7280;margin-top:4px">${a.keyword} · ${a.source} · ${timeAgo(a.pubDate)}</div></li>`
    ).join("\n");
    const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>뉴스 모음</title></head><body style="font-family:'Segoe UI',sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#1f2937"><h1 style="border-bottom:2px solid #3b82f6;padding-bottom:8px">📰 뉴스 모음</h1><p style="color:#6b7280">생성일: ${new Date().toLocaleString("ko-KR")} · 총 ${selectedArticles.length}건</p><ul style="list-style:none;padding:0">${items}</ul></body></html>`;
    download(`news_${Date.now()}.html`, html, "text/html;charset=utf-8");
  };
  const shareMailto = () => {
    const body = selectedArticles.map((a, i) => `${i + 1}. ${a.title}\n   ${a.link}`).join("\n\n");
    window.location.href = `mailto:?subject=${encodeURIComponent(`뉴스 브리핑 - ${new Date().toLocaleDateString("ko-KR")}`)}&body=${encodeURIComponent(body)}`;
  };
  const sendServerEmail = async () => {
    const to = window.prompt("받는 사람 이메일 (비우면 서버 기본 수신자 사용)");
    if (to === null) return;
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articles: selectedArticles, recipient: to || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "전송 실패");
      alert(`이메일 전송 완료 (${data.sent}건)`);
    } catch (e) {
      alert(`이메일 전송 실패: ${e.message}`);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-800">
      {/* 좌측 깃북 스타일 사이드바 */}
      <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0">
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-slate-100">
          <div className="bg-blue-600 text-white p-2 rounded-xl"><Newspaper size={20} /></div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-900 leading-tight">뉴스 모음</h1>
            <p className="text-xs text-slate-500 truncate">키워드별 최신 뉴스</p>
          </div>
        </div>

        <div className="px-4 pt-4 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
          <Layers size={13} /> 키워드
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
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition group ${
                  activeKeyword === "전체"
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-50"
                }`}>
                <Layers size={15} className={activeKeyword === "전체" ? "text-blue-600" : "text-slate-400"} />
                <span className="flex-1 text-left">전체</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeKeyword === "전체" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>{scoped.length}</span>
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

      {/* 우측 메인 영역 */}
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
                placeholder="콤마로 구분하여 키워드 입력 (예: BIM, 스마트건설)"
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
              />
            </div>
            <button onClick={loadTrends} disabled={trendLoading || loading}
              className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-xl font-medium text-sm flex items-center gap-1.5 transition">
              {trendLoading ? <Loader2 size={16} className="animate-spin" /> : <Flame size={16} />}
              트렌드
            </button>
            <button onClick={() => runSearch()} disabled={loading}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-medium text-sm flex items-center gap-2 transition">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {loading ? "검색 중" : "검색"}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-3">
            <div className="flex gap-3">
              {[["naver", "네이버"], ["google", "구글"], ["daum", "다음 (실험적)"]].map(([k, label]) => (
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
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white outline-none focus:border-blue-500">
              {["전체", "기술", "건설", "경제", "안전"].map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white outline-none focus:border-blue-500">
              <option value={1}>최근 1일</option><option value={3}>최근 3일</option>
              <option value={7}>최근 7일</option><option value={30}>최근 30일</option>
              <option value={0}>전체 기간</option>
            </select>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              <button onClick={() => setView("card")}
                className={`px-3 py-1.5 text-sm flex items-center gap-1 ${view === "card" ? "bg-blue-600 text-white" : "bg-white text-slate-500"}`}>
                <LayoutGrid size={15} /> 카드
              </button>
              <button onClick={() => setView("list")}
                className={`px-3 py-1.5 text-sm flex items-center gap-1 ${view === "list" ? "bg-blue-600 text-white" : "bg-white text-slate-500"}`}>
                <List size={15} /> 목록
              </button>
            </div>
            <button onClick={toggleSelectAll}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 flex items-center gap-1">
              {selected.size >= filtered.length && filtered.length
                ? <><CheckSquare size={15} /> 전체 해제</> : <><Square size={15} /> 전체 선택</>}
            </button>
            <div className="ml-auto flex items-center gap-2 text-sm text-slate-400">
              {fromCache && <span className="flex items-center gap-1 text-emerald-600"><Database size={13} /> 캐시</span>}
              <span>{filtered.length}건</span>
            </div>
          </div>
        )}

        {selected.size > 0 && (
          <div className="sticky top-2 z-10 bg-blue-600 text-white rounded-xl px-4 py-2.5 mb-4 flex items-center gap-2 shadow-lg flex-wrap">
            <span className="text-sm font-medium">{selected.size}개 선택됨</span>
            <div className="ml-auto flex gap-1.5 flex-wrap">
              <button onClick={exportCSV} className="px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-sm flex items-center gap-1.5"><Download size={14} /> CSV</button>
              <button onClick={exportHTML} className="px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-sm flex items-center gap-1.5"><FileText size={14} /> HTML</button>
              <button onClick={shareMailto} className="px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-sm flex items-center gap-1.5"><Mail size={14} /> 메일</button>
              <button onClick={sendServerEmail} className="px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-sm flex items-center gap-1.5"><Send size={14} /> 서버전송</button>
              <button onClick={() => setSelected(new Set())} className="px-2 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg"><X size={14} /></button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 mb-4 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => runSearch()} className="flex items-center gap-1 text-amber-700 hover:text-amber-900"><RefreshCw size={14} /> 다시 시도</button>
          </div>
        )}

        {loading && (
          <div className="text-center py-16 text-slate-400">
            <Loader2 size={32} className="animate-spin mx-auto mb-3" />
            <p className="text-sm">뉴스를 가져오는 중...</p>
          </div>
        )}

        {!loading && searched && filtered.length === 0 && !error && (
          <div className="text-center py-16 text-slate-400">
            <Newspaper size={32} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">표시할 뉴스가 없습니다.</p>
          </div>
        )}

        {!loading && Object.entries(groups).map(([keyword, items]) => (
          <div key={keyword} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-semibold text-slate-800">🔍 {keyword}</h2>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{items.length}건</span>
            </div>
            {view === "card" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((a) => {
                  const isSel = selected.has(a.id);
                  return (
                    <div key={a.id} onClick={() => toggleSelect(a.id)}
                      className={`bg-white rounded-xl border p-4 cursor-pointer transition hover:shadow-md ${isSel ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200"}`}>
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 ${isSel ? "text-blue-600" : "text-slate-300"}`}>{isSel ? <CheckSquare size={18} /> : <Square size={18} />}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 leading-snug line-clamp-3">{a.title}</p>
                          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400">
                            <span className="truncate">{a.source}</span><span>·</span>
                            <span className="whitespace-nowrap">{timeAgo(a.pubDate)}</span>
                          </div>
                          <a href={a.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:text-blue-800">기사 보기 <ExternalLink size={11} /></a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                {items.map((a) => {
                  const isSel = selected.has(a.id);
                  return (
                    <div key={a.id} onClick={() => toggleSelect(a.id)}
                      className={`px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50 ${isSel ? "bg-blue-50" : ""}`}>
                      <div className={isSel ? "text-blue-600" : "text-slate-300"}>{isSel ? <CheckSquare size={18} /> : <Square size={18} />}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{a.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{a.source} · {timeAgo(a.pubDate)}</p>
                      </div>
                      <a href={a.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                        className="text-slate-400 hover:text-blue-600 shrink-0"><ExternalLink size={16} /></a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {!searched && !loading && (
          <div className="text-center py-16 text-slate-400">
            <Search size={32} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">키워드를 입력하고 검색해 보세요</p>
          </div>
        )}
      </div>
      </main>
    </div>
  );
}
