import Link from "next/link";
import { getProducts } from "@/services/products";
import type { ProductList, ProductQuery } from "@/types/app";
import { buildListHref, PAGE_SIZE, parseLimit, parseSort, type SearchParams } from "./listParams";
import { LoadError } from "./LoadError";
import { ProductGrid } from "./ProductGrid";
import { SortTabs } from "./SortTabs";

interface ProductListSectionProps {
  filter: Pick<ProductQuery, "artistSlug" | "categorySlug">;
  basePath: string;
  searchParams: Promise<SearchParams>;
}

// 아티스트·카테고리 페이지 공용 상품 목록 (정렬 + 더 보기). Suspense 안에서 렌더링합니다.
export async function ProductListSection({ filter, basePath, searchParams }: ProductListSectionProps) {
  const params = await searchParams;
  const sort = parseSort(params);
  const limit = parseLimit(params);

  let list: ProductList;
  try {
    list = await getProducts({ ...filter, sort, limit });
  } catch (error) {
    return <LoadError error={error} retryHref={buildListHref(basePath, sort, limit)} />;
  }

  const hasMore = list.items.length < list.total;
  return (
    <section aria-label="상품 목록">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          총 <strong className="font-bold text-foreground">{list.total}</strong>개
        </p>
        <SortTabs basePath={basePath} current={sort} />
      </div>
      <ProductGrid products={list.items} />
      {hasMore && (
        <div className="mt-10 flex justify-center">
          <Link
            href={buildListHref(basePath, sort, limit + PAGE_SIZE)}
            scroll={false}
            className="brand-gradient-soft-hover inline-flex h-11 items-center rounded-full border border-line bg-white px-6 text-sm font-bold hover:border-violet-300"
          >
            더 보기
          </Link>
        </div>
      )}
    </section>
  );
}
