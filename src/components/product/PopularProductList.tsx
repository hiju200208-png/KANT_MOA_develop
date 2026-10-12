import { getBestProducts } from "@/services/products";
import type { BestProduct } from "@/types/app";
import { LoadError } from "./LoadError";
import { ProductGrid } from "./ProductGrid";
import { POPULAR_CATEGORY, POPULAR_LIMIT } from "./popularCategory";

// 카테고리 "인기 굿즈": 최근 7일 판매량 순위 (판매가 없으면 최신순으로 채워짐)
export async function PopularProductList() {
  let items: BestProduct[];
  try {
    items = await getBestProducts({ limit: POPULAR_LIMIT });
  } catch (error) {
    return <LoadError error={error} retryHref={`/category/${POPULAR_CATEGORY.slug}`} />;
  }
  return (
    <section aria-label="인기 굿즈 목록">
      <p className="mb-5 text-sm text-muted">최근 7일 판매량 기준</p>
      <ProductGrid products={items} />
    </section>
  );
}
