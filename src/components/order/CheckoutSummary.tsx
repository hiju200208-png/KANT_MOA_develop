import { Button, Card } from "@/components/ui";
import { formatPrice } from "@/lib/formatPrice";
import { StepNumber } from "./StepNumber";

type CheckoutSummaryProps = {
  totalPrice: number;
  shippingFee: number;
  total: number;
  submitError: string | null;
  submitting: boolean;
};

// 주문서 오른쪽 결제 금액 카드 + 결제 버튼 (form 안에서 submit)
export function CheckoutSummary({ totalPrice, shippingFee, total, submitError, submitting }: CheckoutSummaryProps) {
  return (
    <Card className="p-6 lg:sticky lg:top-24">
      <h2 className="flex items-center gap-2 text-lg font-black">
        <StepNumber n={3} />
        결제 금액
      </h2>
      <dl className="mt-5 space-y-3 text-sm">
        <div className="flex justify-between"><dt className="text-muted">상품 금액</dt><dd className="font-bold tabular-nums">{formatPrice(totalPrice)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">배송비</dt><dd className="font-bold tabular-nums">{shippingFee === 0 ? "무료" : formatPrice(shippingFee)}</dd></div>
        <div className="flex items-baseline justify-between border-t border-line pt-4">
          <dt className="font-bold">총 결제 금액</dt>
          <dd className="text-2xl font-black tabular-nums">{formatPrice(total)}</dd>
        </div>
      </dl>
      <p className="mt-4 rounded-lg bg-brand-soft px-3 py-2 text-xs leading-5 text-brand-strong">실제 결제는 이루어지지 않는 테스트 결제예요. 최종 금액은 주문 시 서버에서 다시 계산돼요.</p>
      {submitError && <p role="alert" className="mt-4 text-sm text-danger">{submitError}</p>}
      <Button type="submit" fullWidth size="lg" className="mt-6" loading={submitting}>
        {formatPrice(total)} 결제하기
      </Button>
    </Card>
  );
}
