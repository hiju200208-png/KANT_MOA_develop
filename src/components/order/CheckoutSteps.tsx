const STEPS = ["장바구니", "주문서", "결제 완료"] as const;

// 장바구니 → 주문서 → 결제 완료 진행 단계. current는 지금 단계의 번호(0부터), 앞 단계는 완료로 표시한다.
export function CheckoutSteps({ current }: { current: 0 | 1 | 2 }) {
  return (
    <ol aria-label="주문 단계" className="mb-6 flex items-center gap-1.5 text-xs font-bold md:text-sm">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} aria-current={active ? "step" : undefined} className="flex items-center gap-1.5 whitespace-nowrap md:gap-2">
            {i > 0 && <span aria-hidden="true" className={`h-px w-3 sm:w-6 md:w-10 ${i <= current ? "bg-brand" : "bg-line"}`} />}
            <span
              aria-hidden="true"
              className={`grid size-6 place-items-center rounded-full text-[11px] ${
                done ? "bg-brand text-white" : active ? "bg-foreground text-white" : "border border-line text-muted"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={active ? "text-foreground" : "text-muted"}>
              {label}
              {done && <span className="sr-only"> (완료)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
