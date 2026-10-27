// [프론트 서비스] 주문 목록의 페이지를 읽는다. 화면의 상태별 개수도 이 목록으로 계산한다.
type HistoryPage<T> = { items: T[]; total: number };

export async function readOrderHistory<T>(
  fetchPage: (page: number, size: number) => Promise<HistoryPage<T>>,
): Promise<T[]> {
  const orders: T[] = [];
  const size = 100;
  let page = 1;
  while (true) {
    // API의 페이지 상한을 지키면서 오래된 주문까지 읽는다. 실패는 화면의 오류 처리로 전달한다.
    const result = await fetchPage(page, size);
    orders.push(...result.items);
    if (result.items.length === 0 || page * size >= result.total) return orders;
    page += 1;
  }
}
