"use client";

import { useState } from "react";
import { AddressForm } from "@/components/address/AddressForm";
import { AddressSummary } from "@/components/address/AddressSummary";
import { MAX_ADDRESSES, type AddressDraft } from "@/components/address/addressDraft";
import { Button, Modal } from "@/components/ui";
import type { Address, AddressInput } from "@/types/app";

interface AddressPickerModalProps {
  open: boolean;
  addresses: Address[];
  selectedId: number | null;
  newDraft: AddressDraft; // 새 배송지 추가 폼의 기본값
  onSelect: (id: number) => void;
  onAdd: (input: AddressInput) => Promise<void>;
  onClose: () => void;
}

// 주문서에서 저장된 배송지를 고르거나 새로 추가하는 창
export function AddressPickerModal({ open, addresses, selectedId, newDraft, onSelect, onAdd, onClose }: AddressPickerModalProps) {
  const [adding, setAdding] = useState(false);

  function handleClose() {
    setAdding(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title={adding ? "새 배송지 추가" : "배송지 선택"}>
      <div className="-mx-1 max-h-[60vh] overflow-y-auto px-1">
        {adding ? (
          <AddressForm
            initial={newDraft}
            showDefaultOption
            submitLabel="저장하고 선택"
            idPrefix="picker"
            onCancel={() => setAdding(false)}
            onSubmit={async (input) => {
              await onAdd(input);
              setAdding(false);
            }}
          />
        ) : (
          <div className="space-y-3">
            <ul className="space-y-3">
              {addresses.map((address) => {
                const isSelected = address.id === selectedId;
                return (
                  <li key={address.id}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onSelect(address.id)}
                      className={`w-full rounded-md border p-4 text-left transition-all ${isSelected ? "border-foreground bg-neutral-50" : "brand-gradient-soft-hover border-line hover:border-neutral-400"}`}
                    >
                      <AddressSummary address={address} />
                    </button>
                  </li>
                );
              })}
            </ul>
            {addresses.length < MAX_ADDRESSES && (
              <Button type="button" variant="outline" fullWidth onClick={() => setAdding(true)}>+ 새 배송지 추가</Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
