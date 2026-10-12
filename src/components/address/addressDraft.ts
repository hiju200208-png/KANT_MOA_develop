import type { Address, AddressInput } from "@/types/app";

/** 입력 중인 배송지. 화면에서는 모든 칸을 문자열로 다룬다. */
export type AddressDraft = {
  label: string;
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address1: string;
  address2: string;
};

export type AddressDraftErrors = Partial<Record<keyof AddressDraft, string>>;

export const MAX_ADDRESSES = 10;

export function emptyDraft(defaults: Partial<AddressDraft> = {}): AddressDraft {
  return { label: "", recipientName: "", recipientPhone: "", postalCode: "", address1: "", address2: "", ...defaults };
}

export function draftFromAddress(address: Address): AddressDraft {
  return {
    label: address.label ?? "",
    recipientName: address.recipientName,
    recipientPhone: address.recipientPhone,
    postalCode: address.postalCode,
    address1: address.address1,
    address2: address.address2 ?? "",
  };
}

export function draftToInput(draft: AddressDraft, isDefault?: boolean): AddressInput {
  return {
    label: draft.label.trim() || null,
    recipientName: draft.recipientName.trim(),
    recipientPhone: draft.recipientPhone.trim(),
    postalCode: draft.postalCode.trim(),
    address1: draft.address1.trim(),
    address2: draft.address2.trim() || null,
    isDefault,
  };
}

export function validateDraft(draft: AddressDraft): AddressDraftErrors {
  const errors: AddressDraftErrors = {};
  if (!draft.recipientName.trim()) errors.recipientName = "받는 분 이름을 입력해주세요.";
  if (!/^01\d{8,9}$/.test(draft.recipientPhone.replace(/\D/g, ""))) errors.recipientPhone = "휴대폰 번호를 정확히 입력해주세요.";
  if (!/^\d{5}$/.test(draft.postalCode.trim())) errors.postalCode = "우편번호 5자리를 입력해주세요.";
  if (!draft.address1.trim()) errors.address1 = "기본 주소를 입력해주세요.";
  return errors;
}

/** 숫자만 남기고 010-1234-5678 형태로 맞춘다. */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  const middle = digits.length === 11 ? 7 : 6;
  return `${digits.slice(0, 3)}-${digits.slice(3, middle)}-${digits.slice(middle)}`;
}

/** 주문에 저장하는 주소 문자열 (docs/API_SPEC.md 5-1장) */
export function orderAddressText(address: Pick<Address, "address1" | "address2">): string {
  return `${address.address1} ${address.address2 ?? ""}`.trim();
}
