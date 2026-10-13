import { AddressFields } from "@/components/address/AddressFields";
import { AddressSummary } from "@/components/address/AddressSummary";
import type { AddressDraft, AddressDraftErrors } from "@/components/address/addressDraft";
import { Button, Card } from "@/components/ui";
import type { Address } from "@/types/app";
import { StepNumber } from "./StepNumber";

type CheckoutAddressCardProps = {
  selected: Address | null;
  loadError: string | null;
  draft: AddressDraft;
  draftErrors: AddressDraftErrors;
  onDraftChange: (draft: AddressDraft) => void;
  saveNewAddress: boolean;
  onSaveNewAddressChange: (save: boolean) => void;
  onOpenPicker: () => void;
};

// 주문서 1단계 배송지 카드. 저장된 배송지가 있으면 요약을, 없으면 직접 입력 칸을 보여준다.
export function CheckoutAddressCard({
  selected,
  loadError,
  draft,
  draftErrors,
  onDraftChange,
  saveNewAddress,
  onSaveNewAddressChange,
  onOpenPicker,
}: CheckoutAddressCardProps) {
  return (
    <Card className="space-y-5 p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-lg font-black">
          <StepNumber n={1} />
          배송지
        </h2>
        {selected && (
          <Button type="button" variant="outline" size="sm" onClick={onOpenPicker}>배송지 변경</Button>
        )}
      </div>
      {loadError && <p className="text-sm text-danger">저장된 배송지를 불러오지 못했어요. 이번 주문은 직접 입력해주세요.</p>}
      {selected ? (
        <div className="rounded-md bg-neutral-50 p-4">
          <AddressSummary address={selected} />
        </div>
      ) : (
        <>
          <AddressFields value={draft} errors={draftErrors} onChange={onDraftChange} idPrefix="checkout" showLabel={false} />
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={saveNewAddress} onChange={(e) => onSaveNewAddressChange(e.target.checked)} className="size-5 accent-brand" />
            기본 배송지로 저장
          </label>
        </>
      )}
    </Card>
  );
}
