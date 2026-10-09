"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LoginRequired } from "@/components/order/LoginRequired";
import { OrderStatusBadge } from "@/components/order/OrderStatusBadge";
import { PaymentSuccessMark } from "@/components/order/PaymentSuccessMark";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button, Card, EmptyState, Skeleton } from "@/components/ui";
import { getErrorMessage } from "@/constants/error-messages";
import { useCart } from "@/hooks/useCart";
import { cancelOrder, getOrder, payOrder } from "@/services/orders";
import type { Order } from "@/types/app";

const TITLES = {
  pending: "결제가 완료되지 않았어요",
  paid: "결제가 완료됐어요",
  cancelled: "취소된 주문이에요",
} as const;

// 어떤 주문·사용자에 대한 결과인지 함께 보관해서, 주소나 계정이 바뀌면 이전 결과를 보여주지 않는다.
type Loaded = { key: string; order: Order | null; error: string | null };

export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile, initialized } = useAuth();
  const { refresh: refreshCart } = useCart();
  const userId = profile?.id ?? null;
  const key = `${userId}:${id}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    getOrder(id)
      .then((order) => active && setLoaded({ key, order, error: null }))
      .catch((e) => active && setLoaded({ key, order: null, error: getErrorMessage(e) }));
    return () => {
      active = false;
    };
  }, [id, userId, key]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(getErrorMessage(e));
    }
    try {
      setLoaded({ key, order: await getOrder(id), error: null });
    } catch (e) {
      setError(getErrorMessage(e));
    }
    // 결제되면 결제된 상품이 장바구니에서 빠진다.
    await refreshCart().catch(() => {});
    setBusy(false);
  }

  const current = loaded?.key === key ? loaded : null;
  const order = current?.order;

  if (!initialized || (userId && !current)) {
    return (
      <div className="content-shell py-8 md:py-12">
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="content-shell py-8 md:py-12">
        <LoginRequired next={`/orders/${id}`} />
      </div>
    );
  }

  if (current?.error) {
    return (
      <div className="content-shell py-8 md:py-12">
        <EmptyState title="주문을 불러오지 못했어요" description={current.error} action={<Link href="/orders"><Button>주문/취소 내역으로</Button></Link>} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="content-shell py-8 md:py-12">
        <EmptyState title="주문을 찾을 수 없어요" action={<Link href="/orders"><Button>주문/취소 내역으로</Button></Link>} />
      </div>
    );
  }

  return (
    <div className="content-shell max-w-3xl py-8 md:py-12">
      <div className="mb-6 text-center">
        {order.status === "paid" && <PaymentSuccessMark />}
        <OrderStatusBadge status={order.status} />
        <h1 className="mt-3 text-2xl font-black tracking-[-0.035em]">{TITLES[order.status]}</h1>
        <p className="mt-2 text-xs text-muted">주문번호 {order.id}</p>
      </div>

      <div className="space-y-6">
        <Card className="px-6">
          <h2 className="pt-6 text-lg font-black">주문 상품</h2>
          <ul className="divide-y divide-line">
            {order.items.map((item) => (
              <li key={item.variantId} className="flex justify-between gap-4 py-4 text-sm">
                <div className="min-w-0">
                  <p className="font-bold">{item.productName}</p>
                  <p className="mt-1 text-xs text-muted">{item.optionName} · {item.quantity}개</p>
                </div>
                <p className="shrink-0 font-bold">{(item.unitPrice * item.quantity).toLocaleString("ko-KR")}원</p>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-line py-5 text-base">
            <span className="font-bold">총 결제 금액</span>
            <span className="font-black">{order.totalPrice.toLocaleString("ko-KR")}원</span>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-black">배송 정보</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex gap-4"><dt className="w-16 shrink-0 text-muted">받는 분</dt><dd>{order.recipientName}</dd></div>
            <div className="flex gap-4"><dt className="w-16 shrink-0 text-muted">연락처</dt><dd>{order.recipientPhone}</dd></div>
            <div className="flex gap-4"><dt className="w-16 shrink-0 text-muted">주소</dt><dd>{order.address}</dd></div>
          </dl>
        </Card>

        {error && <p role="alert" className="text-center text-sm text-danger">{error}</p>}

        <div className="flex flex-wrap justify-center gap-3">
          {order.status === "pending" && (
            <Button loading={busy} onClick={() => run(() => payOrder(order.id))}>다시 결제하기</Button>
          )}
          {order.status !== "cancelled" && (
            <Button variant="outline" disabled={busy} onClick={() => window.confirm("주문을 취소할까요?") && run(() => cancelOrder(order.id))}>
              주문 취소
            </Button>
          )}
          <Link href="/orders"><Button variant="ghost">주문/취소 내역</Button></Link>
          <Link href="/"><Button variant="ghost">쇼핑 계속하기</Button></Link>
        </div>
      </div>
    </div>
  );
}
