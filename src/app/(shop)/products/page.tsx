import type { Metadata } from "next";
import { Suspense } from "react";
import { CategoryTabs } from "@/components/product/CategoryTabs";
import type { SearchParams } from "@/components/product/listParams";
import { LoadError } from "@/components/product/LoadError";
import { ALL_CATEGORY, POPULAR_CATEGORY } from "@/components/product/popularCategory";
import { ProductGridSkeleton } from "@/components/product/ProductGrid";
import { ProductListSection } from "@/components/product/ProductListSection";
import { PageTitle, Skeleton } from "@/components/ui";
import { getCategories } from "@/services/products";
import type { Category } from "@/types/app";

export const metadata: Metadata = { title: "전체 상품" };

// 전체 상품 목록: 모든 아티스트·카테고리의 상품을 정렬 + 더 보기로 보여준다.
export default function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <div className="content-shell py-8 md:py-12">
      <PageTitle title="전체 상품" description="모든 아티스트의 굿즈를 한 번에 둘러보세요." />
      <Suspense fallback={<Skeleton className="mb-8 h-10 w-full max-w-xl rounded-full" />}>
        <AllCategoryTabs />
      </Suspense>
      <Suspense fallback={<ProductGridSkeleton />}>
        <ProductListSection filter={{}} basePath="/products" searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function AllCategoryTabs() {
  let categories: Category[];
  try {
    categories = await getCategories();
  } catch (error) {
    return <LoadError error={error} retryHref="/products" />;
  }
  return (
    <div className="mb-8">
      <CategoryTabs categories={[ALL_CATEGORY, POPULAR_CATEGORY, ...categories]} current={ALL_CATEGORY.slug} />
    </div>
  );
}
