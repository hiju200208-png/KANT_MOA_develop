import type { CreateOrderInput, Order, OrderStatus, OrderSummary } from '@/types/app';
import { ApiError, apiFetch, isLoggedIn, jsonBody } from './api';
import { AppError } from './errors';

// 주문·바로 구매·모의 결제·취소: FastAPI /orders (P3). 서버가 소유권(403)·재고·구매 제한을 검사한다

// 토큰 없이 부르면 401이므로 먼저 막음
function requireAuth() {
  if (!isLoggedIn()) throw new AppError('NOT_AUTHENTICATED');
}

// FastAPI 주문 응답 (snake_case)
type OrderResponse = {
  id: string;
  status: string;
  items_price: number;
  shipping_fee: number;
  total_price: number;
  is_direct: boolean;
  recipient_name: string;
  recipient_phone: string;
  address: string;
  items: { variant_id: number; product_name: string; option_name: string; unit_price: number; quantity: number }[];
  created_at: string;
  paid_at: string | null;
  cancelled_at: string | null;
};

const toRecipient = (input: CreateOrderInput) => ({
  recipient_name: input.recipientName,
  recipient_phone: input.recipientPhone,
  address: input.address,
});

export async function createOrder(input: CreateOrderInput): Promise<string> {
  requireAuth();
  const order = await apiFetch<OrderResponse>('/orders', { method: 'POST', ...jsonBody(toRecipient(input)) });
  return order.id;
}

// 바로 구매: 장바구니와 상관없이 옵션 하나만 주문. 결제해도 장바구니는 그대로 둔다.
export async function createDirectOrder(variantId: number, quantity: number, input: CreateOrderInput): Promise<string> {
  requireAuth();
  const order = await apiFetch<OrderResponse>('/orders/direct', {
    method: 'POST',
    ...jsonBody({ ...toRecipient(input), variant_id: variantId, quantity }),
  });
  return order.id;
}

export async function payOrder(orderId: string): Promise<void> {
  requireAuth();
  await apiFetch<OrderResponse>(`/orders/${encodeURIComponent(orderId)}/pay`, { method: 'POST' });
}

export async function cancelOrder(orderId: string): Promise<void> {
  requireAuth();
  await apiFetch<OrderResponse>(`/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'POST' });
}

// 장바구니·주문서 배송비 안내 (로그인 불필요). 실제 배송비는 주문 생성 때 서버가 같은 설정으로 계산
export async function getShippingPolicy(): Promise<{ freeShippingThreshold: number; shippingFee: number }> {
  const p = await apiFetch<{ free_shipping_threshold: number; shipping_fee: number }>('/orders/shipping-policy');
  return { freeShippingThreshold: p.free_shipping_threshold, shippingFee: p.shipping_fee };
}

const toSummary = (o: OrderResponse): OrderSummary => ({
  id: o.id,
  status: o.status as OrderStatus,
  totalPrice: o.total_price,
  itemCount: o.items.length,
  firstItemName: o.items[0]?.product_name ?? '',
  createdAt: o.created_at,
});

// 최신순. 마이페이지 목록은 한 번에 최대 100건 (API 페이지 크기 상한)
export async function getOrders(): Promise<OrderSummary[]> {
  requireAuth();
  const page = await apiFetch<{ items: OrderResponse[] }>('/orders?page=1&size=100');
  return page.items.map(toSummary);
}

export async function getOrder(orderId: string): Promise<Order | null> {
  requireAuth();
  let data: OrderResponse;
  try {
    data = await apiFetch<OrderResponse>(`/orders/${encodeURIComponent(orderId)}`);
  } catch (error) {
    // 없는 주문(404)·남의 주문(403)·uuid 형식 아님(422)은 예전처럼 '없음'으로 다룬다. 서버 연결 실패는 오류 그대로
    if (error instanceof ApiError && [403, 404, 422].includes(error.status)) return null;
    throw error;
  }

  return {
    ...toSummary(data),
    itemsPrice: data.items_price,
    shippingFee: data.shipping_fee,
    recipientName: data.recipient_name,
    recipientPhone: data.recipient_phone,
    address: data.address,
    paidAt: data.paid_at,
    cancelledAt: data.cancelled_at,
    items: data.items.map((i) => ({
      variantId: i.variant_id,
      productName: i.product_name,
      optionName: i.option_name,
      unitPrice: i.unit_price,
      quantity: i.quantity,
    })),
  };
}
