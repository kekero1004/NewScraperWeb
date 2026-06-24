import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

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
    `<!DOCTYPE html><html lang="ko"><head>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.13/html-to-image.min.js" integrity="sha512-iZ2ORl595Wx6miw+GuadDet4WQbdSWS3JLMoNfY8cRGoEFy6oT3G9IbcrBeL6AfkgpA51ETt/faX6yLV+/gFJg==" crossorigin="anonymous" referrerpolicy="no-referrer">