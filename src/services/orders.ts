import { createClient } from '@/lib/supabase/client';
import type { CreateOrderInput, Order, OrderStatus, OrderSummary } from '@/types/app';
import { AppError, toAppError } from './errors';

// 비로그인 상태로 RPC를 부르면 권한 에러(UNKNOWN)가 나므로 먼저 막음
async function requireAuth() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new AppError('NOT_AUTHENTICATED');
  return supabase;
}

export async function createOrder(input: CreateOrderInput): Promise<string> {
  const supabase = await requireAuth();
  const { data, error } = await supabase.rpc('create_order', {
    p_recipient_name: input.recipientName,
    p_recipient_phone: input.recipientPhone,
    p_address: input.address,
  });
  if (error) throw toAppError(error);
  return data;
}

export async function payOrder(orderId: string): Promise<void> {
  const supabase = await requireAuth();
  const { error } = await supabase.rpc('pay_order', { p_order_id: orderId });
  if (error) throw toAppError(error);
}

export async function cancelOrder(orderId: string): Promise<void> {
  const supabase = await requireAuth();
  const { error } = await supabase.rpc('cancel_order', { p_order_id: orderId });
  if (error) throw toAppError(error);
}

type OrderRow = {
  id: string;
  status: string;
  total_price: number;
  created_at: string;
  order_items: { product_name: string; quantity: number }[];
};

const toSummary = (o: OrderRow): OrderSummary => ({
  id: o.id,
  status: o.status as OrderStatus,
  totalPrice: o.total_price,
  itemCount: o.order_items.length,
  firstItemName: o.order_items[0]?.product_name ?? '',
  createdAt: o.created_at,
});

export async function getOrders(): Promise<OrderSummary[]> {
  const supabase = await requireAuth();
  const { data, error } = await supabase
    .from('orders')
    .select('id, status, total_price, created_at, order_items(product_name, quantity)')
    .order('created_at', { ascending: false })
    .order('id', { referencedTable: 'order_items' });
  if (error) throw toAppError(error);
  return data.map(toSummary);
}

export async function getOrder(orderId: string): Promise<Order | null> {
  const supabase = await requireAuth();
  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, status, total_price, created_at, recipient_name, recipient_phone, address, paid_at, cancelled_at, order_items(variant_id, product_name, option_name, unit_price, quantity)',
    )
    .eq('id', orderId)
    .order('id', { referencedTable: 'order_items' })
    .maybeSingle();
  if (error?.code === '22P02') return null; // uuid 형식이 아닌 id
  if (error) throw toAppError(error);
  if (!data) return null; // 없거나 남의 주문 (RLS)

  return {
    ...toSummary(data),
    recipientName: data.recipient_name,
    recipientPhone: data.recipient_phone,
    address: data.address,
    paidAt: data.paid_at,
    cancelledAt: data.cancelled_at,
    items: data.order_items.map((i) => ({
      variantId: i.variant_id,
      productName: i.product_name,
      optionName: i.option_name,
      unitPrice: i.unit_price,
      quantity: i.quantity,
    })),
  };
}
