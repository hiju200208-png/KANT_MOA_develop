// 주문서 카드 제목 앞의 단계 번호 (1 배송지 · 2 주문 상품 · 3 결제 금액)
export function StepNumber({ n }: { n: number }) {
  return (
    <span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-foreground text-xs text-white">
      {n}
    </span>
  );
}
