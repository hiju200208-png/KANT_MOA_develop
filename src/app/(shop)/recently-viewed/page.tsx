import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LikedProductList } from "@/components/product/LikedProducts";
import type { SearchParams } from "@/components/product/listParams";
import { ProductGridSkeleton } from "@/components/product/ProductGrid";
import { RecentlyViewedList } from "@/components/product/RecentlyViewedProducts";
import { PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "최근 본 상품" };

const TABS = [
  { value: "recent", label: "최근 본 상품", href: "/recently-viewed" },
  { value: "likes", label: "좋아요", href: "/recently-viewed?tab=likes" },
] as const;

// 오른쪽 아래 최근 본 상품 동그라미를 누르면 오는 페이지. 탭: 최근 본 상품(이 브라우저, 최대 20개) · 좋아요(로그인 필요)
export default function RecentlyViewedPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <div className="content-shell py-8 md:py-12">
      <PageTitle title="내 상품" />
      <Suspense fallback={<ProductGridSkeleton />}>
        <TabContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function TabContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { tab } = await searchParams;
  const current = tab === "likes" ? "likes" : "recent";
  return (
    <>
      <nav aria-label="내 상품 분류" className="mb-6 flex gap-2">
        {TABS.map((item) => {
          const active = item.value === current;
          return (
            <Link
              key={item.value}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold ${active ? "border-foreground bg-foreground" : "brand-gradient-soft-hover border-line bg-white hover:border-neutral-400"}`}
            >
              <span className={active ? "text-white" : "text-foreground"}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      {current === "likes" ? <LikedProductList /> : <RecentlyViewedList />}
    </>
  );
}
