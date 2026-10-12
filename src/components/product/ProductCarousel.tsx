"use client";

import { useState } from "react";
import type { ProductSummary } from "@/types/app";
import { ProductCard } from "./ProductCard";

const PER_PAGE = 4;
const pad = (n: number) => String(n).padStart(2, "0");

export function ProductCarousel({ products, label }: { products: ProductSummary[]; label: string }) {
  const [page, setPage] = useState(0);
  const pageCount = Math.ceil(products.length / PER_PAGE);
  const visible = products.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const arrowClass = "brand-gradient-soft-hover grid size-10 place-items-center rounded-full border border-line bg-white transition-all hover:border-violet-300 disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:border-line";

  return (
    <div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4" aria-label={`${label} 상품`}>
        {visible.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
      {pageCount > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <button type="button" className={arrowClass} aria-label="이전 상품" disabled={page === 0} onClick={() => setPage(page - 1)}>
            <span aria-hidden="true">‹</span>
          </button>
          <p className="text-sm tabular-nums" aria-live="polite">
            <span className="font-bold">{pad(page + 1)}</span>
            <span className="mx-1.5 text-line" aria-hidden="true">|</span>
            <span className="text-muted">{pad(pageCount)}</span>
          </p>
          <button type="button" className={arrowClass} aria-label="다음 상품" disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)}>
            <span aria-hidden="true">›</span>
          </button>
        </div>
      )}
    </div>
  );
}
