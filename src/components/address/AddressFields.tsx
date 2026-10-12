"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui";
import { AddressSearch } from "./AddressSearch";
import { formatPhone, type AddressDraft, type AddressDraftErrors } from "./addressDraft";

interface AddressFieldsProps {
  value: AddressDraft;
  errors?: AddressDraftErrors;
  onChange: (next: AddressDraft) => void;
  /** 같은 화면에 폼이 둘 이상일 때 id가 겹치지 않게 붙이는 접두어 */
  idPrefix?: string;
  showLabel?: boolean;
}

/** 배송지 입력 칸 묶음. <form>은 쓰는 쪽에서 감싼다. */
export function AddressFields({ value, errors = {}, onChange, idPrefix = "address", showLabel = true }: AddressFieldsProps) {
  const [searching, setSearching] = useState(false);
  const detailRef = useRef<HTMLInputElement>(null);
  const set = (field: keyof AddressDraft) => (event: { target: { value: string } }) =>
    onChange({ ...value, [field]: field === "recipientPhone" ? formatPhone(event.target.value) : event.target.value });

  return (
    <div className="space-y-5">
      {showLabel && (
        <Input id={`${idPrefix}-label`} label="배송지명 (선택)" name="label" placeholder="집, 회사" value={value.label} onChange={set("label")} maxLength={20} />
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <Input id={`${idPrefix}-name`} label="받는 분" name="recipientName" value={value.recipientName} onChange={set("recipientName")} error={errors.recipientName} autoComplete="name" />
        <Input id={`${idPrefix}-phone`} label="연락처" name="recipientPhone" type="tel" inputMode="numeric" placeholder="010-1234-5678" value={value.recipientPhone} onChange={set("recipientPhone")} error={errors.recipientPhone} autoComplete="tel" />
      </div>
      <div className="flex items-end gap-2">
        <div className="w-40 shrink-0">
          <Input id={`${idPrefix}-postal`} label="우편번호" name="postalCode" inputMode="numeric" placeholder="12345" maxLength={5} value={value.postalCode} onChange={set("postalCode")} error={errors.postalCode} autoComplete="postal-code" />
        </div>
        <button
          type="button"
          onClick={() => setSearching((open) => !open)}
          aria-expanded={searching}
          className={`brand-gradient-soft-hover h-12 shrink-0 rounded-md border border-line bg-white px-4 text-sm font-bold ${errors.postalCode ? "mb-6" : ""}`}
        >
          주소 검색
        </button>
      </div>
      {searching && (
        <AddressSearch
          onClose={() => setSearching(false)}
          onSelect={({ postalCode, address1 }) => {
            onChange({ ...value, postalCode, address1 });
            setSearching(false);
            // 고른 뒤 바로 상세 주소를 입력하도록
            requestAnimationFrame(() => detailRef.current?.focus());
          }}
        />
      )}
      <Input id={`${idPrefix}-address1`} label="기본 주소" name="address1" placeholder="주소 검색으로 입력하거나 직접 입력" value={value.address1} onChange={set("address1")} error={errors.address1} autoComplete="address-line1" />
      <Input ref={detailRef} id={`${idPrefix}-address2`} label="상세 주소 (선택)" name="address2" placeholder="동·호수 등" value={value.address2} onChange={set("address2")} autoComplete="address-line2" />
    </div>
  );
}
