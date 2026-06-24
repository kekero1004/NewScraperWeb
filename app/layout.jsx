import "./globals.css";

export const metadata = {
  title: "뉴스 모음",
  description: "키워드로 최신 뉴스를 모아보는 웹앱",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body id="artifacts-component-root-html">{children}</body>
    </html>
  );
}
