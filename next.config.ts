import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  images: {
    // Supabase Storage 공개 버킷 (상품·아티스트 이미지)
    remotePatterns: [
      ...(process.env.NEXT_PUBLIC_SUPABASE_URL ? [new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/**`)] : []),
      new URL(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/static/**`),
      new URL(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/uploads/**`),
    ],
    // 최적화한 이미지를 1년 동안 재사용 (기본 4시간 → 캐시 미스·304 재검증 반복). 이 캐시는 지울 방법이 없어서
    // 이미지 교체는 같은 경로 덮어쓰기가 아니라 새 파일명으로 한다 (docs/BACKEND.md 이미지 업로드 규칙)
    minimumCacheTTL: 31536000,
    // 학원 서버 배포: 이미지가 같은 공개 주소(/backend/static)에 있어 브라우저가 바로 받는다.
    // 서버 안의 이미지 최적화기가 ngrok 공개 주소를 다시 돌아 받지 않게 끈다.
    unoptimized: process.env.NEXT_IMAGE_UNOPTIMIZED === "1",
  },
  // 학원 서버 배포: 공개 주소 하나(ngrok)로 화면과 API를 같이 연다. API_INTERNAL_URL이 있을 때만 켜진다 (로컬 개발은 그대로).
  // - /backend/* → FastAPI (화면이 부르는 API, CORS 없이 같은 주소)
  // - /docs · /openapi.json · /health · /static · /uploads → FastAPI (기존 Swagger·상태 확인·이미지 주소 유지)
  async rewrites() {
    const api = process.env.API_INTERNAL_URL?.replace(/\/$/, "");
    if (!api) return [];
    return [
      { source: "/backend/:path*", destination: `${api}/:path*` },
      { source: "/docs", destination: `${api}/docs` },
      { source: "/openapi.json", destination: `${api}/openapi.json` },
      { source: "/health", destination: `${api}/health` },
      { source: "/static/:path*", destination: `${api}/static/:path*` },
      { source: "/uploads/:path*", destination: `${api}/uploads/:path*` },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
