"use client";

import Link from "next/link";
import { useState } from "react";
import { CartItemRow } from "@/components/cart/CartItemRow";
import { PageTitle } from "@/components/order/PageTitle";
import { Button, Card, EmptyState, Skeleton } from "@/components/ui";
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
      <PageTitle title="장바구니" description={loaded ? `${totalQuantity}개 상품` : undefined} />

      {!loaded ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="장바구니가 비어 있어요"
          description="마음에 드는 굿즈를 담아보세요."
          action={<Link href="/"><Button>상품 보러가기</Button></Link>}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
          <Card className="px-5">
            <ul className="divide-y divide-line">
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
          </Card>

          <Card className="p-6 lg:sticky lg:top-24">
            <h2 className="text-lg font-black">주문 예상 금액</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted">상품 수량</dt><dd className="font-bold">{totalQuantity}개</dd></div>
              <div className="flex justify-between border-t border-line pt-3 text-base"><dt className="font-bold">합계</dt><dd className="font-black">{totalPrice.toLocaleString("ko-KR")}원</dd></div>
            </dl>
            {hasUnavailable && <p className="mt-4 text-xs text-danger">품절·재고 부족 상품은 합계에서 제외됐어요. 삭제 후 주문해주세요.</p>}
            {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
            {/* 주문서 페이지(/checkout)는 다음 작업에서 만든다 */}
            <Link href="/checkout" aria-disabled={hasUnavailable} className={hasUnavailable ? "pointer-events-none" : ""}>
              <Button fullWidth size="lg" className="mt-6" disabled={hasUnavailable}>주문하기</Button>
            </Link>
          </Card>
        </div>
      )}
    </div>
  );
}
