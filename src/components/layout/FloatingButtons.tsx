"use client";

import { usePathname } from "next/navigation";
import { KantBot } from "@/components/chatbot/KantBot";
import { RecentlyViewedButton } from "@/components/product/RecentlyViewedProducts";

// 장바구니·주문서에서는 결제 흐름에 집중하도록 둘 다 숨김
const HIDE_ALL_PATHS = ["/cart", "/checkout"];
// 상품 상세에서는 최근 본 상품만 숨김 (방금 본 상품이 곧 그 동그라미라 겹침)
const HIDE_RECENT_PATHS = ["/products"];

const matches = (pathname: string, paths: string[]) => paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

// 오른쪽 아래 떠 있는 버튼들 (최근 본 상품 · 칸트봇).
// usePathname을 쓰므로 루트 레이아웃에서 반드시 <Suspense>로 감쌀 것 (안 감싸면 빌드 시 미리 렌더링이 막힘)
export function FloatingButtons() {
  const pathname = usePathname();
  if (matches(pathname, HIDE_ALL_PATHS)) return null;
  return (
    <>
      {!matches(pathname, HIDE_RECENT_PATHS) && <RecentlyViewedButton />}
      <KantBot />
    </>
  );
}
