import type { ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import { PageMain } from "@/components/layout/PageMain";
import { RecentlyViewedButton } from "@/components/product/RecentlyViewedProducts";

// 메인 외 페이지: 흰색 전역 헤더 + 본문 + 최근 본 상품 버튼 (메인에서는 안 보임)
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <PageMain>{children}</PageMain>
      <RecentlyViewedButton />
    </>
  );
}
