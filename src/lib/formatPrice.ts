// 가격 표시는 이 함수 하나로 통일한다 (예: 12000 → "12,000원").
export function formatPrice(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}
