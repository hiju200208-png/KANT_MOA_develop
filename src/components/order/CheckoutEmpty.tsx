import Link from "next/link";
import { Button, EmptyState } from "@/components/ui";
import type { CartItem } from "@/types/app";

// 주문서에서 주문할 상품이 없을 때 (장바구니가 비었을 때)
export function CheckoutEmpty() {
  return (
    <div className="content-shell py-8 md:py-12">
      <EmptyState
        title="주문할 상품이 없어요"
        description="장바구니에 상품을 담아주세요."
        action={
          <Link href="/cart">
            <Button>장바구니로 가기</Button>
          </Link>
        }
      />
    </div>
  );
}

// 바로 구매하려던 상품을 지금 살 수 없을 때 (판매 중지·재고 부족·없는 상품)
export function DirectUnavailable({ item, error }: { item: CartItem | null; error: string | null }) {
  return (
    <div className="content-shell py-8 md:py-12">
      <EmptyState
        title="지금은 구매할 수 없는 상품이에요"
        description={error ?? (item ? "판매가 중지되었거나 재고가 부족해요." : "상품을 찾을 수 없어요.")}
        action={
          <Link href={item ? `/products/${item.product.id}` : "/"}>
            <Button>{item ? "상품으로 돌아가기" : "홈으로 가기"}</Button>
          </Link>
        }
      />
    </div>
  );
}
