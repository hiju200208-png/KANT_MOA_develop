"use client";

import { useCart } from "@/hooks/useCart";
import Link from "next/link";
import { CartIcon } from "./Icons";

export function CartButton() {
  const { totalQuantity, loaded } = useCart();

  return (
    <Link
      href="/cart"
      aria-label={loaded ? `장바구니, 상품 ${totalQuantity}개` : "장바구니"}
      className="brand-gradient-icon-hover relative grid size-10 place-items-center rounded-full"
    >
      <CartIcon />
      {loaded && totalQuantity > 0 && (
        <span className="absolute right-0.5 top-0.5 grid min-h-[17px] min-w-[17px] place-items-center rounded-full bg-brand px-1 text-[10px] font-bold leading-none text-white">
          {totalQuantity > 99 ? "99+" : totalQuantity}
        </span>
      )}
    </Link>
  );
}
