interface QuantityStepperProps {
  quantity: number;
  max?: number;
  disabled?: boolean;
  onChange: (quantity: number) => void;
  compact?: boolean; // 상품 상세용 작은 버전 (위버스샵: 높이 28px, 모서리 6px)
}

export function QuantityStepper({ quantity, max, disabled, onChange, compact = false }: QuantityStepperProps) {
  const buttonClass = `brand-gradient-soft-hover grid place-items-center font-bold disabled:cursor-not-allowed disabled:text-neutral-300 ${compact ? "size-7 text-base" : "size-8 rounded-full text-base md:size-9 md:text-lg"}`;
  return (
    <div className={`inline-flex items-center border ${compact ? "h-7 overflow-hidden rounded-[6px] border-[#dcdee4]" : "rounded-full border-line"}`}>
      <button type="button" aria-label="수량 줄이기" className={buttonClass} disabled={disabled || quantity <= 1} onClick={() => onChange(quantity - 1)}>−</button>
      <span className={`text-center font-bold ${compact ? "min-w-7 text-[13px]" : "min-w-7 text-[13px] md:min-w-8 md:text-sm"}`} aria-live="polite">{quantity}</span>
      <button type="button" aria-label="수량 늘리기" className={buttonClass} disabled={disabled || (max !== undefined && quantity >= max)} onClick={() => onChange(quantity + 1)}>+</button>
    </div>
  );
}
