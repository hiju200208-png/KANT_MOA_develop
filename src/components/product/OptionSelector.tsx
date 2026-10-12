import type { Variant } from "@/types/app";
import { formatPrice } from "./formatPrice";

interface OptionSelectorProps {
  variants: Variant[];
  selectedId: number | null;
  onSelect: (variantId: number) => void;
  disabled?: boolean;
}

export function OptionSelector({ variants, selectedId, onSelect, disabled = false }: OptionSelectorProps) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-bold">옵션 선택</legend>
      <div className="flex flex-wrap gap-2">
        {variants.map((variant) => {
          const checked = variant.id === selectedId;
          const unavailable = disabled || variant.isSoldOut;
          return (
            <label
              key={variant.id}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-all has-focus-visible:outline-2 has-focus-visible:outline-brand ${checked ? "border-foreground bg-foreground text-white" : "brand-gradient-soft-hover border-line bg-white hover:border-violet-300"} ${unavailable ? "cursor-not-allowed opacity-40" : ""}`}
            >
              <input
                type="radio"
                name="variant"
                value={variant.id}
                checked={checked}
                disabled={unavailable}
                onChange={() => onSelect(variant.id)}
                className="sr-only"
              />
              {variant.optionName}
              {variant.extraPrice > 0 && <span className="text-xs opacity-80">+{formatPrice(variant.extraPrice)}</span>}
              {variant.isSoldOut && <span className="text-xs">(품절)</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
