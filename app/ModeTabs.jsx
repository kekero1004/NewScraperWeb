"use client";

import { Newspaper, GraduationCap } from "lucide-react";

// 사이드바 상단의 모드 전환 탭 (뉴스 모음 / 논문 Auto-Research)
export default function ModeTabs({ mode, setMode }) {
  const meta = {
    news: { icon: Newspaper, title: "뉴스 모음", subtitle: "키워드별 최신 뉴스" },
    papers: { icon: GraduationCap, title: "논문 Auto-Research", subtitle: "공개 논문 검색·요약" },
  }[mode] || {};
  const HeaderIcon = meta.icon || Newspaper;

  const tabs = [
    { key: "news", label: "뉴스 모음", icon: Newspaper },
    { key: "papers", label: "논문 Auto-Research", icon: GraduationCap },
  ];

  return (
    <div className="border-b border-slate-100">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="bg-blue-600 text-white p-2 rounded-xl"><HeaderIcon size={20} /></div>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-slate-900 leading-tight">{meta.title}</h1>
          <p className="text-xs text-slate-500 truncate">{meta.subtitle}</p>
        </div>
      </div>
      <div className="flex gap-1 px-2 pb-2">
        {tabs.map(({ key, label, icon: Icon }) => {
          const on = mode === key;
          return (
            <button key={key} onClick={() => setMode(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition ${
                on ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"
              }`}>
              <Icon size={14} />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
