import type { Metadata } from "next";
import { PageTitle } from "@/components/order/PageTitle";
import { RecentlyViewedList } from "@/components/product/RecentlyViewedProducts";

export const metadata: Metadata = { title: "최근 본 상품" };

// 이 브라우저에 저장된 최근 본 상품 (로그인 없이도 보임, 최대 20개)
export default function RecentlyViewedPage() {
  return (
    <div className="content-shell py-8 md:py-12">
      <PageTitle title="최근 본 상품" />
      <RecentlyViewedList />
    </div>
  );
}
