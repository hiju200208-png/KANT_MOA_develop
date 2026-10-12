// TODO: 공용 formatPrice(jina 담당 예정)가 생기면 그 함수로 교체하고 이 파일은 삭제합니다.
export function formatPrice(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}
