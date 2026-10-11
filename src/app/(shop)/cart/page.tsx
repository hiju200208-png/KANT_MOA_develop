"use client";

import Link from "next/link";
import { useState } from "react";
import { CartEmpty } from "@/components/cart/CartEmpty";
import { CartItemRow } from "@/components/cart/CartItemRow";
import { CheckoutSteps } from "@/components/order/CheckoutSteps";
import { PageTitle } from "@/components/order/PageTitle";
import { Button, Card, Skeleton } from "@/components/ui";
import { getErrorMessage } from "@/constants/error-messages";
import { useCart } from "@/hooks/useCart";

export default function CartPage() {
  const { items, totalQuantity, totalPrice, loaded, updateQuantity, removeItem } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const hasUnavailable = items.some((item) => !item.isAvailable);

  return (
    <div className="content-shell py-8 md:py-12">
      <CheckoutSteps current={0} />
      <PageTitle title="장바구니" description={loaded ? `${totalQuantity}개 상품` : undefined} />

      {!loaded ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      ) : items.length === 0 ? (
        <CartEmpty />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          <ul className="space-y-3">
            {items.map((item) => (
              <CartItemRow
                key={item.variantId}
                item={item}
                busy={busy}
                onQuantityChange={(variantId, quantity) => run(() => updateQuantity(variantId, quantity))}
                onRemove={(variantId) => run(() => removeItem(variantId))}
              />
            ))}
          </ul>

          <Card className="p-6 lg:sticky lg:top-24">
            <h2 className="text-lg font-black">주문 예상 금액</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted">상품 수량</dt><dd className="font-bold">{totalQuantity}개</dd></div>
              <div className="flex justify-between"><dt className="text-muted">상품 금액</dt><dd className="font-bold tabular-nums">{totalPrice.toLocaleString("ko-KR")}원</dd></div>
              <div className="flex items-baseline justify-between border-t border-line pt-4">
                <dt className="font-bold">합계</dt>
                <dd className="text-2xl font-black tabular-nums">{totalPrice.toLocaleString("ko-KR")}원</dd>
              </div>
            </dl>
            {hasUnavailable && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-danger">품절·재고 부족 상품은 합계에서 제외됐어요. 삭제 후 주문해주세요.</p>}
            {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
            <Link href="/checkout" aria-disabled={hasUnavailable} className={hasUnavailable ? "pointer-events-none" : ""}>
              <Button fullWidth size="lg" className="mt-6" disabled={hasUnavailable}>주문하기</Button>
            </Link>
            <p className="mt-3 text-center text-xs text-muted">다음 단계에서 배송지를 확인해요</p>
          </Card>
        </div>
      )}
    </div>
  );
}
