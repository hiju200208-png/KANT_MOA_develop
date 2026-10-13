import type { Metadata } from "next";
import { LikedProductList } from "@/components/product/LikedProducts";
import { PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "좋아요한 상품" };

// 상품 상세에서 하트를 누른 상품 모음 (로그인 필요)
export default function LikesPage() {
  return (
    <div className="content-shell py-8 md:py-12">
      <PageTitle title="좋아요한 상품" />
      <LikedProductList />
    </div>
  );
}
