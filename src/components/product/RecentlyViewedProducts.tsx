"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { ProductSummary } from "@/types/app";
import { ProductCard } from "./ProductCard";

const STORAGE_KEY = "kantmoa-recently-viewed";
const MAX_ITEMS = 8;

function readRecentlyViewed(): ProductSummary[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ProductSummary => (
      typeof item === "object" && item !== null && typeof (item as ProductSummary).id === "number"
    )).slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export function RecentlyViewedTracker({ product }: { product: ProductSummary }) {
  useEffect(() => {
    try {
      const current = readRecentlyViewed();
      const summary: ProductSummary = {
        id: product.id,
        name: product.name,
        price: product.price,
        status: product.status,
        isSoldOut: product.isSoldOut,
        thumbnailUrl: product.thumbnailUrl,
        artist: product.artist,
        category: product.category,
      };
      const next = [summary, ...current.filter((item) => item.id !== product.id)].slice(0, MAX_ITEMS);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 저장소가 차거나 차단돼도 상품 상세 화면은 정상적으로 유지합니다.
    }
  }, [product]);

  return null;
}

export function RecentlyViewedProducts() {
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const products = mounted ? readRecentlyViewed() : [];

  if (products.length === 0) return null;

  return (
    <section aria-labelledby="recently-viewed-products" className="rounded-3xl border-2 border-violet-200 bg-linear-to-br from-white via-violet-50/60 to-teal-50/60 p-4 shadow-lg shadow-violet-100/60 md:p-6">
      <div className="mb-4">
        <h2 id="recently-viewed-products" className="text-xl font-black md:text-2xl">최근 본 상품</h2>
        <p className="mt-1 text-sm text-muted">방금 둘러본 굿즈를 다시 확인해보세요.</p>
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
        {products.slice(0, 4).map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </section>
  );
}
