"use client";

import Link from "next/link";
import { useState } from "react";
import { QuantityStepper } from "@/components/cart/QuantityStepper";
import { Button } from "@/components/ui";
import { getErrorMessage } from "@/constants/error-messages";
import { useCart } from "@/hooks/useCart";
import type { ProductDetail, Variant } from "@/types/app";
import { formatPrice } from "./formatPrice";
import { OptionSelector } from "./OptionSelector";

type Feedback = { type: "success" | "error"; text: string } | null;

function maxQuantity(variant: Variant) {
  return variant.maxPerUser === null ? variant.stock : Math.min(variant.stock, variant.maxPerUser);
}

export function ProductPurchasePanel({ product }: { product: ProductDetail }) {
  const { addItem } = useCart();
  const [selectedId, setSelectedId] = useState<number | null>(product.hasOptions ? null : product.variants[0]?.id ?? null);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const selected = product.variants.find((variant) => variant.id === selectedId) ?? null;
  const unitPrice = selected?.price ?? product.price;
  const canBuy = !product.isSoldOut && selected !== null && !selected.isSoldOut;

  function handleSelect(variantId: number) {
    setSelectedId(variantId);
    setQuantity(1);
    setFeedback(null);
  }

  async function handleAddToCart() {
    if (!selected) return;
    setBusy(true);
    setFeedback(null);
    try {
      await addItem(selected.id, quantity);
      setFeedback({ type: "success", text: "장바구니에 담았어요." });
    } catch (error) {
      setFeedback({ type: "error", text: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {product.hasOptions && (
        <OptionSelector variants={product.variants} selectedId={selectedId} onSelect={handleSelect} disabled={product.isSoldOut} />
      )}

      {selected && !selected.isSoldOut && (
        <div className="flex items-center justify-between rounded-md bg-neutral-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold">{product.hasOptions ? selected.optionName : "수량"}</p>
            {selected.maxPerUser !== null && <p className="mt-0.5 text-xs text-muted">1인 최대 {selected.maxPerUser}개</p>}
          </div>
          <QuantityStepper quantity={quantity} max={maxQuantity(selected)} disabled={busy} onChange={setQuantity} />
        </div>
      )}

      <div className="flex items-baseline justify-between border-t border-line pt-4">
        <span className="text-sm font-semibold text-muted">총 상품 금액</span>
        <span className="text-2xl font-black">{formatPrice(unitPrice * (selected ? quantity : 1))}</span>
      </div>

      <Button size="lg" fullWidth loading={busy} disabled={!canBuy} onClick={handleAddToCart}>
        {product.isSoldOut ? "품절" : selected ? "장바구니 담기" : "옵션을 선택해주세요"}
      </Button>

      {feedback && (
        <p role="status" className={`text-sm font-semibold ${feedback.type === "error" ? "text-danger" : "text-brand-strong"}`}>
          {feedback.text}{" "}
          {feedback.type === "success" && <Link href="/cart" className="underline underline-offset-2">장바구니 보기</Link>}
        </p>
      )}
    </div>
  );
}
