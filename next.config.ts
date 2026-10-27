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
