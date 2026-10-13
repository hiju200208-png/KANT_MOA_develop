import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { buildListHref, PAGE_SIZE, parseLimit, type SearchParams } from "@/components/product/listParams";
import { LoadError } from "@/components/product/LoadError";
import { ProductGrid, ProductGridSkeleton } from "@/components/product/ProductGrid";
import { SearchForm } from "@/components/product/SearchForm";
import { EmptyState, PageTitle } from "@/components/ui";
import { searchProducts } from "@/services/products";
import type { ProductList } from "@/types/app";

export const metadata: Metadata = { title: "상품 검색" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// 상품 검색: 상품명·아티스트명(영문·한글) 부분 일치, 최신순 + 더 보기
export default function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <div className="content-shell py-8 md:py-12">
      <PageTitle title="상품 검색" />
      <Suspense fallback={<SearchSkeleton />}>
        <SearchContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SearchContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const q = (first(params.q) ?? "").trim();
  return (
    <>
      <div className="max-w-xl">
        <SearchForm key={q} defaultValue={q} autoFocus={!q} />
      </div>
      <div className="mt-8">
        {q ? (
          <Suspense key={q} fallback={<ProductGridSkeleton />}>
            <SearchResults q={q} limit={parseLimit(params)} />
          </Suspense>
        ) : (
          <EmptyState title="찾고 싶은 굿즈를 검색해 보세요" description="예: 응원봉, 앨범, BTS, 세븐틴" />
        )}
      </div>
    </>
  );
}

async function SearchResults({ q, limit }: { q: string; limit: number }) {
  const basePath = `/search?q=${encodeURIComponent(q)}`;
  let list: ProductList;
  try {
    list = await searchProducts({ q, limit });
  } catch (error) {
    return <LoadError error={error} retryHref={basePath} />;
  }
  if (list.total === 0) {
    return <EmptyState title={`"${q}" 검색 결과가 없어요`} description="다른 검색어로 찾아보거나 전체 상품을 둘러보세요." />;
  }
  const moreHref = buildListHref(basePath, "latest", limit + PAGE_SIZE);
  return (
    <section aria-label="검색 결과">
      <p className="mb-5 text-sm text-muted">
        &quot;{q}&quot; 검색 결과 <strong className="font-bold text-foreground">{list.total}</strong>개
      </p>
      <ProductGrid products={list.items} />
      {list.items.length < list.total && (
        <div className="mt-10 flex justify-center">
          <Link href={moreHref} scroll={false} className="brand-gradient-soft-hover inline-flex h-11 items-center rounded-full border border-line bg-white px-6 text-sm font-bold hover:border-neutral-400">
            더 보기
          </Link>
        </div>
      )}
    </section>
  );
}

function SearchSkeleton() {
  return (
    <>
      <div className="h-12 max-w-xl animate-pulse rounded-full bg-neutral-100" />
      <div className="mt-8">
        <ProductGridSkeleton />
      </div>
    </>
  );
}
