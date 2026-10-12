"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui";
import { getErrorMessage } from "@/constants/error-messages";
import type { AddressInput } from "@/types/app";
import { AddressFields } from "./AddressFields";
import { draftToInput, validateDraft, type AddressDraft, type AddressDraftErrors } from "./addressDraft";

interface AddressFormProps {
  initial: AddressDraft;
  /** 이미 기본 배송지인 주소를 고칠 때는 체크박스를 숨긴다 (기본 해제는 없음) */
  showDefaultOption: boolean;
  defaultChecked?: boolean;
  submitLabel: string;
  idPrefix?: string;
  onSubmit: (input: AddressInput) => Promise<void>;
  onCancel: () => void;
}

export function AddressForm({ initial, showDefaultOption, defaultChecked = false, submitLabel, idPrefix, onSubmit, onCancel }: AddressFormProps) {
  const [draft, setDraft] = useState(initial);
  const [isDefault, setIsDefault] = useState(defaultChecked);
  const [errors, setErrors] = useState<AddressDraftErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validateDraft(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setSubmitError(null);
    try {
      await onSubmit(draftToInput(draft, showDefaultOption ? isDefault : undefined));
    } catch (error) {
      setSubmitError(getErrorMessage(error));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <AddressFields value={draft} errors={errors} onChange={setDraft} idPrefix={idPrefix} />
      {showDefaultOption && (
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="size-5 accent-brand" />
          기본 배송지로 설정
        </label>
      )}
      {submitError && <p role="alert" className="text-sm text-danger">{submitError}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>취소</Button>
        <Button type="submit" loading={saving}>{submitLabel}</Button>
      </div>
    </form>
  );
}
