"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, EmptyState, PageTitle, Skeleton } from "@/components/ui";
import { formatPrice } from "@/lib/formatPrice";
import { STATUS_LABELS, STATUS_OPTIONS, filtersFromQuery, toggleSelected } from "@/services/admin/adminForm";
import { bulkChangeStatus, changeProductStatus, listAdminProducts } from "@/services/admin/api";
import { adminErrorMessage } from "@/services/admin/client";
import type { AdminProductListItem, Page, ProductFilters, ProductStatus } from "@/types/admin";
import { AdminErrorBox, StatusBadge, StockText, Thumb } from "./AdminParts";

const INITIAL: ProductFilters = { q: "", artist: "", category: "", status: "", stock: "", sort: "latest", page: 1, size: 20 };
const selectClass = "h-10 rounded-md border border-line bg-white px-3 text-sm";

// 관리자 상품 목록: 숨김 포함, 검색·필터·정렬·페이지, 행에서 바로 판매 상태 변경, 여러 개 한 번에 상태 변경
export function AdminProductList() {
  const params = useSearchParams();
  const [filters, setFilters] = useState<ProductFilters>(() => ({ ...INITIAL, ...filtersFromQuery((k) => params.get(k)) }));
  const [keyword, setKeyword] = useState(() => filters.q);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [bulkStatus, setBulkStatus] = useState<ProductStatus>("hidden");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [data, setData] = useState<Page<AdminProductListItem> | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (next: ProductFilters) => {
    setLoading(true);
    setError(null);
    try {
      setData(await listAdminProducts(next));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 필터가 바뀔 때마다 서버 목록을 다시 받는다
    void load(filters);
  }, [filters, load]);

  function update(patch: Partial<ProductFilters>) {
    setFilters((prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }));
    setSelected(new Set()); // 다른 목록으로 바뀌면 선택 초기화
  }

  async function handleBulk() {
    if (selected.size === 0) return;
    setBulkSaving(true);
    setNotice(null);
    try {
      const result = await bulkChangeStatus([...selected], bulkStatus);
      setNotice(`${result.updated}개 상품을 ${STATUS_LABELS[bulkStatus]}(으)로 바꿨어요.`);
      setSelected(new Set());
      await load(filters);
    } catch (e) {
      setNotice(adminErrorMessage(e)); // 하나라도 실패하면 서버가 전부 취소한다
    } finally {
      setBulkSaving(false);
    }
  }

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    update({ q: keyword });
  }

  async function handleStatus(item: AdminProductListItem, status: ProductStatus) {
    if (status === item.status) return;
    setSavingId(item.id);
    setNotice(null);
    try {
      const updated = await changeProductStatus(item.id, status);
      setData((prev) =>
        prev && { ...prev, items: prev.items.map((p) => (p.id === item.id ? { ...p, status: updated.status, is_sold_out: updated.is_sold_out } : p)) },
      );
      setNotice(`'${item.name}' 상태를 ${STATUS_LABELS[status]}(으)로 바꿨어요.`);
    } catch (e) {
      setNotice(adminErrorMessage(e));
    } finally {
      setSavingId(null);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  return (
    <section>
      <PageTitle title="상품·재고 관리" description="숨김 상품까지 모두 보여요. 재고는 상품을 눌러 옵션별로 조정해요." />

      <form onSubmit={handleSearch} className="mb-4 flex flex-wrap items-center gap-2">
        <input
          aria-label="상품명 검색"
          value={keyword}
          maxLength={100}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="상품명 검색"
          className="h-10 min-w-48 flex-1 rounded-md border border-line px-3 text-sm"
        />
        <input aria-label="아티스트 slug" value={filters.artist} onChange={(e) => update({ artist: e.target.value.trim() })} placeholder="아티스트 slug" className="h-10 w-36 rounded-md border border-line px-3 text-sm" />
        <select aria-label="판매 상태" className={selectClass} value={filters.status} onChange={(e) => update({ status: e.target.value as ProductFilters["status"] })}>
          <option value="">전체 상태</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select aria-label="재고" className={selectClass} value={filters.stock} onChange={(e) => update({ stock: e.target.value as ProductFilters["stock"] })}>
          <option value="">전체 재고</option>
          <option value="out">재고 없음</option>
          <option value="low">재고 부족(5개 이하 옵션)</option>
        </select>
        <select aria-label="정렬" className={selectClass} value={filters.sort} onChange={(e) => update({ sort: e.target.value as ProductFilters["sort"] })}>
          <option value="latest">최신순</option>
          <option value="stock_asc">재고 적은 순</option>
          <option value="name">이름순</option>
        </select>
        <Button type="submit" size="sm">검색</Button>
      </form>

      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-line bg-white px-4 py-2 text-sm">
          <b>{selected.size}개 선택</b>
          <select aria-label="선택한 상품 상태" className={selectClass} value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as ProductStatus)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <Button size="sm" loading={bulkSaving} onClick={handleBulk}>한 번에 바꾸기</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>선택 해제</Button>
        </div>
      )}

      {notice && <p role="status" className="mb-3 rounded-md bg-neutral-100 px-4 py-2 text-sm">{notice}</p>}

      {error ? (
        <AdminErrorBox error={error} onRetry={() => load(filters)} />
      ) : loading && !data ? (
        <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : data && data.items.length === 0 ? (
        <EmptyState title="조건에 맞는 상품이 없어요." description="검색어나 필터를 바꿔보세요." />
      ) : (
        data && (
          <>
            <p className="mb-2 text-sm text-muted">총 {data.total.toLocaleString()}개</p>
            <div className="overflow-x-auto rounded-lg border border-line bg-white">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-neutral-50 text-left text-xs text-muted">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label="이 페이지 상품 모두 선택"
                        checked={data.items.length > 0 && data.items.every((i) => selected.has(i.id))}
                        onChange={(e) => setSelected(e.target.checked ? new Set(data.items.map((i) => i.id)) : new Set())}
                      />
                    </th>
                    <th className="px-4 py-3">상품</th>
                    <th className="px-4 py-3">아티스트</th>
                    <th className="px-4 py-3 text-right">가격</th>
                    <th className="px-4 py-3 text-right">총재고</th>
                    <th className="px-4 py-3">상태</th>
                    <th className="px-4 py-3">상태 변경</th>
                  </tr>
                </thead>
                <tbody aria-busy={loading}>
                  {data.items.map((item) => (
                    <tr key={item.id} className={`border-t border-line ${selected.has(item.id) ? "bg-brand-soft/40" : ""}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`${item.name} 선택`}
                          checked={selected.has(item.id)}
                          onChange={() => setSelected((prev) => toggleSelected(prev, item.id))}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/products/${item.id}`} className="flex items-center gap-3 font-bold hover:underline">
                          <Thumb src={item.thumbnail_url} alt="" />
                          <span>
                            {item.name}
                            <span className="block text-xs font-normal text-muted">옵션 {item.variant_count}개 · #{item.id}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">{item.artist.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatPrice(item.price)}</td>
                      <td className="px-4 py-3 text-right"><StockText total={item.total_stock} isSoldOut={item.is_sold_out} /></td>
                      <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                      <td className="px-4 py-3">
                        <select
                          aria-label={`${item.name} 판매 상태 변경`}
                          className={selectClass}
                          value={item.status}
                          disabled={savingId === item.id}
                          onChange={(e) => handleStatus(item, e.target.value as ProductStatus)}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-center gap-3 text-sm">
              <Button size="sm" variant="outline" disabled={filters.page <= 1} onClick={() => update({ page: filters.page - 1 })}>이전</Button>
              <span className="tabular-nums">{filters.page} / {totalPages}</span>
              <Button size="sm" variant="outline" disabled={filters.page >= totalPages} onClick={() => update({ page: filters.page + 1 })}>다음</Button>
            </div>
          </>
        )
      )}
    </section>
  );
}
