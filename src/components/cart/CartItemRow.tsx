"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui";
import type { CartItem } from "@/types/app";
import { QuantityStepper } from "./QuantityStepper";
import { formatPrice } from "@/lib/formatPrice";

const REMOVE_ANIMATION_MS = 200;

interface CartItemRowProps {
  item: CartItem;
  busy?: boolean;
  onQuantityChange: (variantId: number, quantity: number) => void;
  onRemove: (variantId: number) => void | Promise<void>;
}

export function CartItemRow({ item, busy, onQuantityChange, onRemove }: CartItemRowProps) {
  const [removing, setRemoving] = useState(false);
  // 재고와 1인 구매 제한 중 더 작은 값이 선택 가능한 최대 수량
  const limits = [item.stock, item.maxPerUser].filter((value): value is number => value !== null);
  const max = Math.min(...limits);

  // 옆으로 밀려나며 사라진 뒤 삭제한다. 삭제가 실패하면 다시 보인다.
  async function handleRemove() {
    setRemoving(true);
    await new Promise((resolve) => setTimeout(resolve, REMOVE_ANIMATION_MS));
    await onRemove(item.variantId);
    setRemoving(false);
  }

  return (
    <li
      className={`flex gap-3 rounded-lg p-3 shadow-card md:gap-4 md:p-4 transition-all duration-200 ${item.isAvailable ? "bg-white" : "bg-neutral-50"} ${
        removing ? "-translate-x-4 opacity-0" : ""
      }`}
    >
      <Link href={`/products/${item.product.id}`} className="size-20 shrink-0 overflow-hidden rounded-md bg-neutral-100 md:size-28">
        {item.product.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.product.thumbnailUrl}
            alt={item.product.name}
            className={`size-full object-cover transition-transform duration-300 hover:scale-105 ${item.isAvailable ? "" : "opacity-50 grayscale"}`}
          />
        ) : (
          <span className="grid size-full place-items-center text-xs text-muted">이미지 없음</span>
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/products/${item.product.id}`} className="line-clamp-2 text-[13px] leading-[18px] font-bold md:text-base">{item.product.name}</Link>
            <p className="mt-1 inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-muted md:text-xs">{item.optionName}</p>
          </div>
          <button
            type="button"
            aria-label={`${item.product.name} 삭제`}
            disabled={busy || removing}
            onClick={handleRemove}
            className="-mr-2 -mt-2 grid size-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-danger disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 pt-2 md:pt-3">
          {item.isAvailable ? (
            <QuantityStepper quantity={item.quantity} max={max} disabled={busy || removing} onChange={(quantity) => onQuantityChange(item.variantId, quantity)} />
          ) : (
            <Badge className="bg-red-50 text-danger">품절·재고 부족</Badge>
          )}
          <p className="whitespace-nowrap text-sm font-black tabular-nums md:text-base">{formatPrice(item.unitPrice * item.quantity)}</p>
        </div>
      </div>
    </li>
  );
}
