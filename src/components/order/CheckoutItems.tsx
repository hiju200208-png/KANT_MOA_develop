import type { CartItem } from "@/types/app";
import { formatPrice } from "@/lib/formatPrice";

// 주문서의 주문 상품 목록 (썸네일 · 상품명 · 옵션 · 수량 · 금액)
export function CheckoutItems({ items }: { items: CartItem[] }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <li key={item.variantId} className="flex items-center gap-4 py-4 text-sm">
          <span className="size-14 shrink-0 overflow-hidden rounded-md bg-neutral-100">
            {item.product.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.product.thumbnailUrl} alt="" className="size-full object-cover" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{item.product.name}</p>
            <p className="mt-1 text-xs text-muted">{item.optionName} · {item.quantity}개</p>
          </div>
          <p className="shrink-0 font-bold tabular-nums">{formatPrice(item.unitPrice * item.quantity)}</p>
        </li>
      ))}
    </ul>
  );
}
