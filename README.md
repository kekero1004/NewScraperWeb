# 뉴스 모음 (Next.js 풀스택)

키워드/트렌드로 최신 뉴스를 모아 보고, CSV·HTML·이메일로 내보내는 웹앱.
네이버 API 호출과 키워드 캐싱은 모두 서버(App Router Route Handlers)에서 처리합니다.

## 실행

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev                  # http://localhost:3000
```

## 환경변수 (.env.local)

| 변수 | 설명 |
|------|------|
| NAVER_CLIENT_ID / NAVER_CLIENT_SECRET | 네이버 검색 API. 없으면 구글 RSS만 사용 |
| CACHE_TTL_SECONDS | 캐시 유지 시간(초), 기본 600 |
| UPSTASH_REDIS_REST_URL / _TOKEN | Upstash Redis. 없으면 인메모리 캐시로 폴백 |
| SMTP_HOST/PORT/USER/PASS | 이메일 발송용. Gmail은 앱 비밀번호 사용 |
| MAIL_RECIPIENT | 기본 수신자 |

## 구조

```
app/
  layout.jsx
  page.jsx              프론트 (클라이언트 컴포넌트)
  globals.css
  api/
    news/route.js       뉴스 수집 + 캐싱
    trends/route.js     트렌드 키워드
    email/route.js      SMTP 발송
lib/
  scrapers.js           네이버 / 구글RSS / 다음
  trends.js             트렌드 키워드 (3단계 폴백)
  cache.js              Upstash Redis / 인메모리
```

## Vercel 배포

GitHub 푸시 후 Vercel Import → Settings → Environment Variables 에 위 변수 등록 → 배포.

## 운영 주의

- 인메모리 캐시는 서버 인스턴스 단위입니다. 서버리스 환경에서 캐시를 공유하려면 Upstash Redis 환경변수를 설정하세요(코드 변경 불필요).
- /api/email 은 외부에 노출되는 POST 입니다. 공개 서비스라면 인증/레이트리밋을 추가하세요.
- 다음(Daum) 스크래퍼는 HTML 구조 변경에 취약하므로 기본 비활성화되어 있습니다.
