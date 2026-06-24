import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildHtml(articles) {
  const items = articles
    .map(
      (a) =>
        `<li style="margin-bottom:14px">` +
        `<a href="${a.link}" target="_blank" style="font-size:16px;font-weight:600;color:#1d4ed8;text-decoration:none">${a.title}</a>` +
        `<div style="font-size:12px;color:#6b7280;margin-top:4px">${a.keyword || ""} · ${a.source || ""}</div>` +
        `</li>`
    )
    .join("");
  return (
    `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>뉴스 모음</title></head>` +
    `<body style="font-family:'Segoe UI',sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#1f2937">` +
    `<h1 style="border-bottom:2px solid #3b82f6;padding-bottom:8px">📰 뉴스 모음</h1>` +
    `<p style="color:#6b7280">생성일: ${new Date().toLocaleString("ko-KR")} · 총 ${articles.length}건</p>` +
    `<ul style="list-style:none;padding:0">${items}</ul>` +
    `</body></html>`
  );
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 본문입니다." }, { status: 400 });
  }

  const articles = Array.isArray(body?.articles) ? body.articles : [];
  if (articles.length === 0) {
    return NextResponse.json({ error: "보낼 기사가 없습니다." }, { status: 400 });
  }

  const recipient = body?.recipient || process.env.MAIL_RECIPIENT;
  if (!recipient) {
    return NextResponse.json({ error: "수신자가 지정되지 않았습니다." }, { status: 400 });
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return NextResponse.json({ error: "SMTP 환경변수가 설정되지 않았습니다." }, { status: 500 });
  }

  const port = Number(SMTP_PORT) || 587;
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  try {
    await transporter.sendMail({
      from: SMTP_USER,
      to: recipient,
      subject: `뉴스 브리핑 - ${new Date().toLocaleDateString("ko-KR")}`,
      html: buildHtml(articles),
    });
  } catch (e) {
    return NextResponse.json({ error: `이메일 전송 실패: ${e.message}` }, { status: 502 });
  }

  return NextResponse.json({ sent: articles.length, recipient });
}
