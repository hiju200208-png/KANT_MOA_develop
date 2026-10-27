"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageTitle, Skeleton } from "@/components/ui";
import { getAdminDashboard } from "@/services/admin/api";
import type { AdminDashboard } from "@/types/admin";
import { AdminErrorBox } from "./AdminParts";

// 카드마다 상품 목록의 같은 필터로 연결한다 (숫자 = 눌렀을 때 나오는 상품 수)
const CARDS: { key: keyof AdminDashboard; label: string; href: string; tone?: "warn" | "danger" | "muted" }[] = [
  { key: "total", label: "전체 상품", href: "/admin/products" },
  { key: "on_sale", label: "판매중", href: "/admin/products?status=on_sale" },
  { key: "out_of_stock", label: "재고 없음", href: "/admin/products?stock=out", tone: "danger" },
  { key: "low_stock", label: "재고 부족 (옵션 5개 이하)", href: "/admin/products?stock=low&sort=stock_asc", tone: "warn" },
  { key: "sold_out", label: "품절 처리", href: "/admin/products?status=sold_out", tone: "muted" },
  { key: "hidden", label: "숨김", href: "/admin/products?status=hidden", tone: "muted" },
];

const TONE = { warn: "text-amber-600", danger: "text-danger", muted: "text-neutral-500" } as const;

export function AdminDashboardView() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await getAdminDashboard());
    } catch (e) {
      setError(e);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 화면에 들어오면 요약 숫자를 받는다
    void load();
  }, [load]);

  return (
    <section>
      <PageTitle title="관리자 대시보드" description="카드를 누르면 해당 조건의 상품 목록으로 이동해요." />
      {data && data.out_of_stock + data.low_stock > 0 && (
        <Link
          href="/admin/products?stock=low&sort=stock_asc"
          role="alert"
          className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          <span>
            <strong>재고 확인이 필요해요.</strong> 재고 없음 {data.out_of_stock.toLocaleString()}개, 재고 부족{" "}
            {data.low_stock.toLocaleString()}개
          </span>
          <span className="shrink-0 font-bold underline">재고 적은 순으로 보기</span>
        </Link>
      )}
      {error ? (
        <AdminErrorBox error={error} onRetry={load} />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {CARDS.map((card) => (
            <Link
              key={card.key}
              href={card.href}
              className="rounded-lg border border-line bg-white p-5 transition hover:border-neutral-400 hover:shadow-card"
            >
              <p className="text-sm text-muted">{card.label}</p>
              {data ? (
                <p className={`mt-2 text-3xl font-black tabular-nums ${card.tone ? TONE[card.tone] : ""}`}>
                  {data[card.key].toLocaleString()}
                </p>
              ) : (
                <Skeleton className="mt-2 h-9 w-16" />
              )}
            </Link>
          ))}
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link href="/admin/products" className="font-bold underline">상품·재고 관리로</Link>
        <Link href="/admin/notices" className="font-bold underline">공지 관리로</Link>
      </div>
    </section>
  );
}
