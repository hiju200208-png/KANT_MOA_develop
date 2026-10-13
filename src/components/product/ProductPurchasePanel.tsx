"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { QuantityStepper } from "@/components/cart/QuantityStepper";
import { Button } from "@/components/ui";
import { getErrorMessage } from "@/constants/error-messages";
import { useCart } from "@/hooks/useCart";
import type { ProductDetail, Variant } from "@/types/app";
import { formatPrice } from "@/lib/formatPrice";
import { OptionSelector } from "./OptionSelector";

type Feedback = { type: "success" | "error"; text: string } | null;

function maxQuantity(variant: Variant) {
  return variant.maxPerUser === null ? variant.stock : Math.min(variant.stock, variant.maxPerUser);
}

export function ProductPurchasePanel({ product }: { product: ProductDetail }) {
  const router = useRouter();
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

  // 장바구니에 담지 않고 이 옵션·수량만으로 주문서를 연다. 재고·구매 제한은 주문서와 서버에서 다시 확인한다.
  function handleBuyNow() {
    if (!selected) return;
    router.push(`/checkout?variant=${selected.id}&qty=${quantity}`);
  }

  return (
    <div className="space-y-4">
      {product.hasOptions && (
        <OptionSelector variants={product.variants} selectedId={selectedId} onSelect={handleSelect} disabled={product.isSoldOut} />
      )}

      {selected && !selected.isSoldOut && (
        <div className="rounded-[8px] border border-[#ebedf2] p-3">
          <p className="text-[13px] leading-[17px] break-all text-[#666]">{product.hasOptions ? `${product.name} / ${selected.optionName}` : product.name}</p>
          <div className="mt-3.5 flex items-center justify-between">
            <QuantityStepper compact quantity={quantity} max={maxQuantity(selected)} disabled={busy} onChange={setQuantity} />
            <span className="text-sm leading-[18px] font-bold whitespace-nowrap">{formatPrice(unitPrice * quantity)}</span>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between pt-1">
        <div>
          <p className="text-sm leading-[18px] font-medium text-[#111]">{selected ? `${quantity}개 선택` : "총 상품 금액"}</p>
          {selected?.maxPerUser != null && <p className="mt-1 text-[13px] leading-[17px] text-[#8e8e8e]">계정당 최대 {selected.maxPerUser}개까지 구매할 수 있어요.</p>}
        </div>
        <span className="text-lg leading-[23px] font-extrabold whitespace-nowrap">{formatPrice(unitPrice * (selected ? quantity : 1))}</span>
      </div>

      {canBuy ? (
        <div className="flex gap-2">
          <Button variant="outline" size="md" className="flex-1 rounded-[8px]! text-[15px]!" loading={busy} onClick={handleAddToCart}>
            장바구니 담기
          </Button>
          <Button size="md" className="flex-1 rounded-[8px]! text-[15px]!" disabled={busy} onClick={handleBuyNow}>
            바로 구매
          </Button>
        </div>
      ) : (
        <Button size="md" fullWidth className="rounded-[8px]! text-[15px]!" disabled>
          {product.isSoldOut || selected?.isSoldOut ? "품절" : "옵션을 선택해주세요"}
        </Button>
      )}

      {feedback && (
        <p role="status" className={`text-[13px] font-semibold ${feedback.type === "error" ? "text-danger" : "text-brand-strong"}`}>
          {feedback.text}{" "}
          {feedback.type === "success" && <Link href="/cart" className="underline underline-offset-2">장바구니 보기</Link>}
        </p>
      )}
    </div>
  );
}
