interface QuantityStepperProps {
  quantity: number;
  max?: number;
  disabled?: boolean;
  onChange: (quantity: number) => void;
}

export function QuantityStepper({ quantity, max, disabled, onChange }: QuantityStepperProps) {
  const buttonClass = "brand-gradient-soft-hover grid size-8 place-items-center rounded-full text-lg font-bold disabled:cursor-not-allowed disabled:text-neutral-300";
  return (
    <div className="inline-flex items-center rounded-full border border-line">
      <button type="button" aria-label="수량 줄이기" className={buttonClass} disabled={disabled || quantity <= 1} onClick={() => onChange(quantity - 1)}>−</button>
      <span className="min-w-8 text-center text-sm font-bold" aria-live="polite">{quantity}</span>
      <button type="button" aria-label="수량 늘리기" className={buttonClass} disabled={disabled || (max !== undefined && quantity >= max)} onClick={() => onChange(quantity + 1)}>+</button>
    </div>
  );
}
