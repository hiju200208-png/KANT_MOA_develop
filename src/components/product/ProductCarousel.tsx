"use client";

import { useState, useSyncExternalStore } from "react";
import type { ProductSummary } from "@/types/app";
import { ProductCard } from "./ProductCard";
import { useSwipe } from "./useSwipe";

// PC(lg 이상)는 한 페이지 5개, 그보다 좁으면 4개(2열 × 2줄). 서버 렌더링은 PC 기준
const WIDE_QUERY = "(min-width: 1024px)";
const subscribeWide = (onChange: () => void) => {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const EDGE_RESISTANCE = 3; // 첫·마지막 페이지에서 바깥쪽으로 끌면 덜 움직이게
const pad = (n: number) => String(n).padStart(2, "0");

export function ProductCarousel({ products, label }: { products: ProductSummary[]; label: string }) {
  const [rawPage, setPage] = useState(0);
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE_QUERY).matches, () => true);
  const perPage = wide ? 5 : 4;
  const pageCount = Math.ceil(products.length / perPage);
  const page = Math.min(rawPage, pageCount - 1); // 화면 폭이 바뀌어 페이지 수가 줄어도 범위 안으로
  const pages = Array.from({ length: pageCount }, (_, i) => products.slice(i * perPage, i * perPage + perPage));
  const move = (step: number) => setPage(Math.min(Math.max(page + step, 0), pageCount - 1));
  const { dragX, dragging, handlers } = useSwipe({ enabled: pageCount > 1, onSwipe: move });
  const atEdge = (page === 0 && dragX > 0) || (page === pageCount - 1 && dragX < 0);
  const offset = atEdge ? dragX / EDGE_RESISTANCE : dragX;
  const arrowClass = "brand-gradient-soft-hover grid size-9 place-items-center rounded-full border border-line bg-white transition-all hover:border-violet-300 disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:border-line";

  return (
    <div>
      <div className="overflow-x-clip">
        <div
          className={`flex touch-pan-y select-none ${dragging ? "cursor-grabbing" : "transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"}`}
          style={{ transform: `translateX(calc(-${page * 100}% + ${offset}px))` }}
          {...handlers}
        >
          {pages.map((items, i) => (
            <ul
              key={i}
              className="grid w-full shrink-0 grid-cols-2 content-start gap-x-4 gap-y-6 md:grid-cols-4 lg:grid-cols-5"
              aria-label={`${label} 상품 ${i + 1} / ${pageCount}`}
              aria-hidden={i !== page}
              inert={i !== page}
            >
              {items.map((product) => (
                <li key={product.id}>
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
      {pageCount > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <button type="button" className={arrowClass} aria-label="이전 상품" disabled={page === 0} onClick={() => move(-1)}>
            <span aria-hidden="true">‹</span>
          </button>
          <p className="text-sm tabular-nums" aria-live="polite">
            <span className="font-bold">{pad(page + 1)}</span>
            <span className="mx-1.5 text-line" aria-hidden="true">|</span>
            <span className="text-muted">{pad(pageCount)}</span>
          </p>
          <button type="button" className={arrowClass} aria-label="다음 상품" disabled={page >= pageCount - 1} onClick={() => move(1)}>
            <span aria-hidden="true">›</span>
          </button>
        </div>
      )}
    </div>
  );
}
