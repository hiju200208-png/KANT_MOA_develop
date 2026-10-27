"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button, Card, PageTitle } from "@/components/ui";
import { adminErrorMessage } from "@/services/admin/client";
import { changeShipping, getAdminOrders, type AdminOrder, type AdminOrdersPage, type AdminOrdersQuery } from "@/services/adminOrders";
import { nextShippingStatus } from "@/services/shippingActions";
import { formatPrice } from "@/lib/formatPrice";

const paymentLabels = { pending: "결제 대기", paid: "결제 완료", cancelled: "취소" };
const shippingLabels = { not_applicable: "배송 대상 아님", preparing: "배송 준비", shipped: "발송", delivered: "배송 완료" };
type Loaded = { key: string; data?: AdminOrdersPage; error?: string };
type Action = { key: string; order: AdminOrder; target: 'shipped' | 'delivered' };

export default function AdminOrdersPageView() {
  const { profile, initialized } = useAuth();
  const userId = profile?.id ?? null;
  const [query, setQuery] = useState<AdminOrdersQuery>({ q: '', status: '', shipping_status: '', page: 1 });
  const [search, setSearch] = useState('');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  // 계정·검색 조건이 바뀌면 이전 계정의 개인정보나 이전 목록을 표시하지 않는다.
  const key = JSON.stringify([userId, query]);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    getAdminOrders(query)
      .then(data => { if (active) setLoaded({ key, data }); })
      .catch(error => { if (active) setLoaded({ key, error: adminErrorMessage(error) }); });
    return () => { active = false; };
  }, [userId, query, key]);
  const current = loaded?.key === key ? loaded : null;
  const confirmation = action?.key === key ? action : null;

  async function confirm() {
    if (!confirmation) return;
    setBusy(true);
    setActionError('');
    try {
      await changeShipping(confirmation.order.id, confirmation.target);
      const data = await getAdminOrders(query);
      // 처리 중 계정·필터가 바뀌었다면 새 목록을 이전 요청 결과로 덮지 않는다.
      setLoaded(previous => previous?.key === key ? { key, data } : previous);
      setAction(null);
    } catch (error) {
      setActionError(adminErrorMessage(error));
    } finally { setBusy(false); }
  }

  return <div className="space-y-5">
    <PageTitle title="주문·배송 관리" />
    <p className="text-sm text-muted">결제 완료 주문을 배송 준비 → 발송 → 배송 완료 순서로 처리합니다. 발송 이후 고객의 일반 취소는 제한됩니다.</p>
    {!initialized ? <p role="status">로그인 확인 중…</p> : !userId ?
      <Link href="/admin/login">관리자 로그인</Link> : <>
      <form className="flex flex-wrap gap-3" onSubmit={event => { event.preventDefault(); setQuery({ ...query, q: search.trim(), page: 1 }); }}>
        <input aria-label="주문 검색" maxLength={50} value={search} onChange={e => setSearch(e.target.value)} placeholder="주문번호·상품명·받는 분" className="rounded-lg border border-line px-3 py-2" />
        <label>결제 상태 <select aria-label="결제 상태" value={query.status} onChange={e => setQuery({ ...query, status: e.target.value, page: 1 })} className="rounded-lg border border-line p-2">
          <option value="">전체</option>{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label>배송 상태 <select aria-label="배송 상태" value={query.shipping_status} onChange={e => setQuery({ ...query, shipping_status: e.target.value, page: 1 })} className="rounded-lg border border-line p-2">
          <option value="">전체</option><option value="preparing">배송 준비</option><option value="shipped">발송</option><option value="delivered">배송 완료</option>
        </select></label>
        <Button type="submit">검색</Button>
      </form>
      {!current ? <p role="status">주문을 불러오는 중…</p> : current.error ? <p role="alert">{current.error}</p> : current.data && <>
        <p>총 {current.data.total}건</p>
        {current.data.items.length === 0 && <p>조건에 맞는 주문이 없어요.</p>}
        <ul className="space-y-4">{current.data.items.map(order => {
          const target = nextShippingStatus(order.status, order.shipping_status);
          return <li key={order.id}><Card className="space-y-3 p-5">
            <div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold">주문 {order.id}</h2><strong>{formatPrice(order.total_price)}</strong></div>
            <p>{paymentLabels[order.status]} · {shippingLabels[order.shipping_status]} · {new Date(order.created_at).toLocaleString('ko-KR')}</p>
            <ul>{order.items.map((item, i) => <li key={i}>{item.product_name} / {item.option_name} · {item.quantity}개</li>)}</ul>
            <details><summary className="cursor-pointer">배송 정보 보기</summary><p>{order.recipient_name} · {order.recipient_phone}</p><p>{order.address}</p></details>
            {order.shipped_at && <p>발송: {new Date(order.shipped_at).toLocaleString('ko-KR')}</p>}
            {order.delivered_at && <p>배송 완료: {new Date(order.delivered_at).toLocaleString('ko-KR')}</p>}
            {target && <Button disabled={busy} onClick={() => { setActionError(''); setAction({ key, order, target }); }}>{target === 'shipped' ? '발송 처리' : '배송 완료 처리'}</Button>}
          </Card></li>;
        })}</ul>
        <nav aria-label="주문 페이지" className="flex items-center gap-4">
          <Button disabled={query.page <= 1 || busy} onClick={() => setQuery({ ...query, page: query.page - 1 })}>이전</Button>
          <span>{query.page} / {Math.max(1, Math.ceil(current.data.total / current.data.size))}</span>
          <Button disabled={query.page * current.data.size >= current.data.total || busy} onClick={() => setQuery({ ...query, page: query.page + 1 })}>다음</Button>
        </nav>
      </>}
      {confirmation && <section role="dialog" aria-modal="true" aria-label="배송 상태 변경 확인" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <Card className="max-w-lg space-y-4 p-6"><h2 className="font-bold">{confirmation.target === 'shipped' ? '발송 처리할까요?' : '배송 완료로 처리할까요?'}</h2>
          <p>주문 {confirmation.order.id}</p><p>{confirmation.target === 'shipped' ? '실제 발송을 확인해 주세요. 발송 후에는 고객이 일반 취소할 수 없습니다.' : '실제 배송 완료를 확인해 주세요.'}</p>
          {actionError && <p role="alert">{actionError}</p>}
          <div className="flex gap-3"><Button disabled={busy} onClick={() => setAction(null)}>닫기</Button><Button loading={busy} onClick={confirm}>변경 확정</Button></div>
        </Card>
      </section>}
    </>}
  </div>;
}
