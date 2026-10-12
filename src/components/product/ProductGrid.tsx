import Link from "next/link";
import { EmptyState, Skeleton } from "@/components/ui";
import type { ProductSummary } from "@/types/app";
import { ProductCard } from "./ProductCard";

const GRID_CLASS = "grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4";

export function ProductGrid({ products }: { products: ProductSummary[] }) {
  if (products.length === 0) {
    return (
      <EmptyState
        title="아직 등록된 굿즈가 없어요"
        description="곧 새로운 굿즈로 찾아올게요."
        action={<Link href="/" className="inline-flex h-11 items-center rounded-full bg-foreground px-5 text-sm font-bold hover:bg-neutral-800"><span className="text-white">홈으로 가기</span></Link>}
      />
    );
  }
  return (
    <ul className={GRID_CLASS}>
      {products.map((product) => (
        <li key={product.id} className="reveal">
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className={GRID_CLASS} aria-busy="true" aria-label="상품을 불러오는 중">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="mt-3 h-3 w-1/3" />
          <Skeleton className="mt-2 h-4 w-4/5" />
          <Skeleton className="mt-2 h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}
