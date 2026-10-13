"use client";

import { usePathname } from "next/navigation";
import { KantBot } from "@/components/chatbot/KantBot";
import { RecentlyViewedButton } from "@/components/product/RecentlyViewedProducts";

// 장바구니·주문서에서는 결제 흐름에 집중하도록 숨김
const HIDDEN_PATHS = ["/cart", "/checkout"];

// 오른쪽 아래 떠 있는 버튼들 (최근 본 상품 · 칸트봇).
// usePathname을 쓰므로 루트 레이아웃에서 반드시 <Suspense>로 감쌀 것 (안 감싸면 빌드 시 미리 렌더링이 막힘)
export function FloatingButtons() {
  const pathname = usePathname();
  if (HIDDEN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return null;
  return (
    <>
      <RecentlyViewedButton />
      <KantBot />
    </>
  );
}
