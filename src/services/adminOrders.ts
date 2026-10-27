// [프론트 서비스] 관리자 주문·배송. 서버의 ADMIN 권한 검사를 반드시 통과해야 한다.
import { adminFetch } from './admin/client';
import type { ShippingStatus } from './shippingActions';

export type AdminOrder = {
  id: string; user_id: string; status: 'pending' | 'paid' | 'cancelled';
  shipping_status: ShippingStatus; total_price: number; created_at: string;
  recipient_name: string; recipient_phone: string; address: string;
  shipped_at: string | null; delivered_at: string | null;
  items: { product_name: string; option_name: string; quantity: number }[];
};
export type AdminOrdersQuery = { q: string; status: string; shipping_status: string; page: number };
export type AdminOrdersPage = { items: AdminOrder[]; total: number; page: number; size: number };

export function getAdminOrders(query: AdminOrdersQuery): Promise<AdminOrdersPage> {
  const params = new URLSearchParams({ page: String(query.page), size: '20' });
  for (const key of ['q', 'status', 'shipping_status'] as const) {
    if (query[key]) params.set(key, query[key]);
  }
  return adminFetch(`/orders/admin?${params}`, { headers: { "ngrok-skip-browser-warning": "true" } });
}

export function changeShipping(id: string, status: 'shipped' | 'delivered'): Promise<AdminOrder> {
  return adminFetch(`/orders/admin/${encodeURIComponent(id)}/shipping`, {
    headers: { 'ngrok-skip-browser-warning': 'true' }, method: 'PATCH', body: JSON.stringify({ status }),
  });
}
