// 장바구니·주문서 표시용 배송비. 실제 결제 금액은 create_order가 같은 규칙으로 DB에서 계산
export function calcShippingFee(itemsPrice: number, settings: { freeShippingThreshold: number; shippingFee: number }): number {
  if (itemsPrice <= 0) return 0;
  return itemsPrice >= settings.freeShippingThreshold ? 0 : settings.shippingFee;
}
