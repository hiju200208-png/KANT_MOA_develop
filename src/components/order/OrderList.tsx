"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LoginRequired } from "@/components/order/LoginRequired";
import { OrderStatusBadge } from "@/components/order/OrderStatusBadge";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button, Card, EmptyState, Skeleton } from "@/components/ui";
import { getErrorMessage } from "@/constants/error-messages";
import { getOrders } from "@/services/orders";
import type { OrderStatus, OrderSummary } from "@/types/app";

type Tab = "all" | OrderStatus;

const TABS: { value: Tab; label: string; empty: string }[] = [
  { value: "all", label: "전체", empty: "주문 내역이 없어요" },
  { value: "paid", label: "결제 완료", empty: "결제 완료된 주문이 없어요" },
  { value: "pending", label: "결제 대기", empty: "결제 대기 중인 주문이 없어요" },
  { value: "cancelled", label: "취소", empty: "취소한 주문이 없어요" },
];

// 결과를 사용자 id와 함께 보관해서, 다른 계정으로 바뀌면 이전 목록을 보여주지 않는다.
type Loaded = { userId: string; orders: OrderSummary[] | null; error: string | null };

function parseTab(value: string | null): Tab {
  return TABS.some((tab) => tab.value === value) ? (value as Tab) : "all";
}

function orderTitle(order: OrderSummary) {
  return order.itemCount > 1 ? `${order.firstItemName} 외 ${order.itemCount - 1}건` : order.firstItemName;
}

export function OrderList() {
  const tab = parseTab(useSearchParams().get("status"));
  const { profile, initialized } = useAuth();
  const userId = profile?.id ?? null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    getOrders()
      .then((orders) => active && setLoaded({ userId, orders, error: null }))
      .catch((error) => active && setLoaded({ userId, orders: null, error: getErrorMessage(error) }));
    return () => {
      active = false;
    };
  }, [userId]);

  const current = loaded?.userId === userId ? loaded : null;

  if (!initialized || (userId && !current)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-11 w-full max-w-md rounded-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!userId) return <LoginRequired next={tab === "all" ? "/orders" : `/orders?status=${tab}`} />;

  if (current?.error) return <p role="alert" className="text-sm text-danger">{current.error}</p>;

  const orders = current?.orders ?? [];
  const counts = Object.fromEntries(
    TABS.map(({ value }) => [value, value === "all" ? orders.length : orders.filter((o) => o.status === value).length]),
  ) as Record<Tab, number>;
  const visible = tab === "all" ? orders : orders.filter((order) => order.status === tab);
  const emptyTitle = TABS.find((item) => item.value === tab)!.empty;

  return (
    <div className="space-y-6">
      <nav aria-label="주문 상태" className="-mx-1 overflow-x-auto px-1">
        <ul className="flex w-max gap-2">
          {TABS.map((item) => {
            const selected = item.value === tab;
            return (
              <li key={item.value}>
                <Link
                  href={item.value === "all" ? "/orders" : `/orders?status=${item.value}`}
                  replace
                  scroll={false}
                  aria-current={selected ? "page" : undefined}
                  className={`inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-bold transition-colors ${
                    selected ? "border-foreground bg-foreground text-white" : "brand-gradient-soft-hover border-line bg-white text-neutral-700 hover:border-violet-300"
                  }`}
                >
                  <span className={selected ? "text-white" : undefined}>{item.label}</span>
                  <span className={selected ? "text-white/70" : "text-muted"}>{counts[item.value]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {visible.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={tab === "all" ? "첫 굿즈를 주문해보세요." : undefined}
          action={tab === "all" ? <Link href="/"><Button>상품 보러가기</Button></Link> : undefined}
        />
      ) : (
        <ul className="space-y-4">
          {visible.map((order) => {
            // 전체 탭에서는 취소된 주문을 흐리게 보여 진행 중인 주문이 눈에 띄게 한다.
            const dimmed = tab === "all" && order.status === "cancelled";
            return (
              <li key={order.id}>
                <Link href={`/orders/${order.id}`}>
                  <Card className={`brand-gradient-soft-hover flex items-center justify-between gap-4 p-5 ${dimmed ? "opacity-60" : ""}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <OrderStatusBadge status={order.status} />
                        <time dateTime={order.createdAt} className="text-xs text-muted">
                          {new Date(order.createdAt).toLocaleDateString("ko-KR")}
                        </time>
                      </div>
                      <p className="mt-2 truncate font-bold">{orderTitle(order)}</p>
                    </div>
                    <p className="shrink-0 text-base font-black">{order.totalPrice.toLocaleString("ko-KR")}원</p>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
