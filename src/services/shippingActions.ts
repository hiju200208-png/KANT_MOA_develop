// [프론트 규칙] 버튼은 안내용이고 최종 결제·배송 상태 검사는 서버가 한다.
export type ShippingStatus = 'not_applicable' | 'preparing' | 'shipped' | 'delivered';
export function nextShippingStatus(payment: string, shipping: ShippingStatus): 'shipped' | 'delivered' | null {
  if (payment !== 'paid') return null;
  return shipping === 'preparing' ? 'shipped' : shipping === 'shipped' ? 'delivered' : null;
}
