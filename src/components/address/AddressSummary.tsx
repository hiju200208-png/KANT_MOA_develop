import { Badge } from "@/components/ui";
import type { Address } from "@/types/app";

/** 배송지 한 건의 내용 (카드·선택 목록에서 공통으로 사용) */
export function AddressSummary({ address }: { address: Address }) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold">{address.label ?? address.recipientName}</span>
        {address.isDefault && <Badge>기본 배송지</Badge>}
      </div>
      <p className="text-sm text-neutral-700">
        {address.label && <>{address.recipientName} · </>}
        {address.recipientPhone}
      </p>
      <p className="text-sm leading-6 text-neutral-700">
        [{address.postalCode}] {address.address1} {address.address2}
      </p>
    </div>
  );
}
