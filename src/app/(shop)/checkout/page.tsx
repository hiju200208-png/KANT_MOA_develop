"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AddressFields } from "@/components/address/AddressFields";
import { AddressForm } from "@/components/address/AddressForm";
import { AddressSummary } from "@/components/address/AddressSummary";
import {
  MAX_ADDRESSES,
  draftToInput,
  emptyDraft,
  formatPhone,
  orderAddressText,
  validateDraft,
  type AddressDraft,
  type AddressDraftErrors,
} from "@/components/address/addressDraft";
import { LoginRequired } from "@/components/order/LoginRequired";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button, Card, EmptyState, Modal, SectionHeader, Skeleton } from "@/components/ui";
import { getErrorCode, getErrorMessage } from "@/constants/error-messages";
import { useCart } from "@/hooks/useCart";
import { createAddress, getAddresses } from "@/services/addresses";
import { createOrder, payOrder } from "@/services/orders";
import type { Address, AddressInput } from "@/types/app";

// 결과를 사용자 id와 함께 보관해서, 다른 계정으로 바뀌면 이전 주소를 쓰지 않는다.
type LoadedAddresses = { userId: string; addresses: Address[]; error: string | null };

export default function CheckoutPage() {
  const router = useRouter();
  const { profile, initialized } = useAuth();
  const { items, totalQuantity, totalPrice, loaded, refresh } = useCart();
  const userId = profile?.id ?? null;

  const [addressState, setAddressState] = useState<LoadedAddresses | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerAdding, setPickerAdding] = useState(false);

  // 저장된 배송지가 없을 때 직접 입력하는 칸. 고치기 전에는 프로필 이름·연락처를 기본값으로 보여준다.
  const [draftEdits, setDraftEdits] = useState<AddressDraft | null>(null);
  const [saveNewAddress, setSaveNewAddress] = useState(true);
  const [draftErrors, setDraftErrors] = useState<AddressDraftErrors>({});

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    getAddresses()
      .then((addresses) => active && setAddressState({ userId, addresses, error: null }))
      .catch((error) => active && setAddressState({ userId, addresses: [], error: getErrorMessage(error) }));
    return () => {
      active = false;
    };
  }, [userId]);

  const current = addressState?.userId === userId ? addressState : null;
  const addresses = current?.addresses ?? [];
  // 기본 배송지는 항상 맨 앞 (docs/API_SPEC.md 5-1장)
  const selected = addresses.find((address) => address.id === selectedId) ?? addresses[0] ?? null;
  const draft =
    draftEdits ?? emptyDraft({ recipientName: profile?.nickname ?? "", recipientPhone: profile?.phone ? formatPhone(profile.phone) : "" });

  async function addFromPicker(input: AddressInput) {
    const created = await createAddress(input);
    if (userId) setAddressState({ userId, addresses: await getAddresses(), error: null });
    setSelectedId(created.id);
    setPickerAdding(false);
    setPickerOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    let recipient: { recipientName: string; recipientPhone: string; address: string };
    let newAddress: AddressInput | null = null;
    if (selected) {
      recipient = { recipientName: selected.recipientName, recipientPhone: selected.recipientPhone, address: orderAddressText(selected) };
    } else {
      const errors = validateDraft(draft);
      setDraftErrors(errors);
      if (Object.keys(errors).length > 0) return;
      const input = draftToInput(draft, true);
      recipient = { recipientName: input.recipientName, recipientPhone: input.recipientPhone, address: orderAddressText(input) };
      if (saveNewAddress) newAddress = input;
    }

    setSubmitting(true);
    let orderId: string;
    try {
      orderId = await createOrder(recipient);
    } catch (error) {
      if (getErrorCode(error) === "NOT_AUTHENTICATED") return router.push("/login?next=/checkout");
      setSubmitError(getErrorMessage(error));
      setSubmitting(false);
      return;
    }

    // 주소 저장은 주문을 막지 않는다. 실패하면 마이페이지에서 다시 추가하면 된다.
    if (newAddress) await createAddress(newAddress).catch(() => {});

    try {
      await payOrder(orderId);
    } catch {
      // 결제가 실패하면 주문은 결제 대기로 남는다. 주문 상세에서 다시 결제하거나 취소할 수 있다.
    }
    // 결제된 상품은 서버에서 장바구니에서 빠지므로 다시 불러온다.
    await refresh().catch(() => {});
    router.push(`/orders/${orderId}`);
  }

  if (!initialized || !loaded || (userId && !current)) {
    return (
      <div className="content-shell py-8 md:py-12">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="content-shell py-8 md:py-12">
        <LoginRequired next="/checkout" description="로그인하면 담아둔 상품이 그대로 장바구니에 남아 있어요." />
      </div>
    );
  }

  if (items.length === 0 && !submitting) {
    return (
      <div className="content-shell py-8 md:py-12">
        <EmptyState
          title="주문할 상품이 없어요"
          description="장바구니에 상품을 담아주세요."
          action={<Button onClick={() => router.push("/cart")}>장바구니로 가기</Button>}
        />
      </div>
    );
  }

  return (
    <div className="content-shell py-8 md:py-12">
      <SectionHeader title="주문서" description="배송 정보를 확인하고 결제해주세요." />
      <form onSubmit={handleSubmit} noValidate className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-6">
          <Card className="space-y-5 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-black">배송지</h2>
              {selected && (
                <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>배송지 변경</Button>
              )}
            </div>
            {current?.error && <p className="text-sm text-danger">저장된 배송지를 불러오지 못했어요. 이번 주문은 직접 입력해주세요.</p>}
            {selected ? (
              <AddressSummary address={selected} />
            ) : (
              <>
                <AddressFields value={draft} errors={draftErrors} onChange={setDraftEdits} idPrefix="checkout" showLabel={false} />
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold">
                  <input type="checkbox" checked={saveNewAddress} onChange={(e) => setSaveNewAddress(e.target.checked)} className="size-5 accent-brand" />
                  기본 배송지로 저장
                </label>
              </>
            )}
          </Card>

          <Card className="px-6">
            <h2 className="pt-6 text-lg font-black">주문 상품 {totalQuantity}개</h2>
            <ul className="divide-y divide-line">
              {items.map((item) => (
                <li key={item.variantId} className="flex justify-between gap-4 py-4 text-sm">
                  <div className="min-w-0">
                    <p className="font-bold">{item.product.name}</p>
                    <p className="mt-1 text-xs text-muted">{item.optionName} · {item.quantity}개</p>
                  </div>
                  <p className="shrink-0 font-bold">{(item.unitPrice * item.quantity).toLocaleString("ko-KR")}원</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card className="p-6 lg:sticky lg:top-24">
          <h2 className="text-lg font-black">결제 금액</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between border-t border-line pt-3 text-base">
              <dt className="font-bold">총 결제 금액</dt>
              <dd className="font-black">{totalPrice.toLocaleString("ko-KR")}원</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted">실제 결제는 이루어지지 않는 테스트 결제예요. 최종 금액은 주문 시 서버에서 다시 계산돼요.</p>
          {submitError && <p role="alert" className="mt-4 text-sm text-danger">{submitError}</p>}
          <Button type="submit" fullWidth size="lg" className="mt-6" loading={submitting}>결제하기</Button>
        </Card>
      </form>

      <Modal
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setPickerAdding(false);
        }}
        title={pickerAdding ? "새 배송지 추가" : "배송지 선택"}
      >
        <div className="-mx-1 max-h-[60vh] overflow-y-auto px-1">
          {pickerAdding ? (
            <AddressForm
              initial={emptyDraft({ recipientName: profile.nickname, recipientPhone: profile.phone ? formatPhone(profile.phone) : "" })}
              showDefaultOption
              submitLabel="저장하고 선택"
              idPrefix="picker"
              onCancel={() => setPickerAdding(false)}
              onSubmit={addFromPicker}
            />
          ) : (
            <div className="space-y-3">
              <ul className="space-y-3">
                {addresses.map((address) => {
                  const isSelected = address.id === selected?.id;
                  return (
                    <li key={address.id}>
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelectedId(address.id);
                          setPickerOpen(false);
                        }}
                        className={`w-full rounded-md border p-4 text-left transition-all ${isSelected ? "border-foreground bg-neutral-50" : "brand-gradient-soft-hover border-line hover:border-violet-300"}`}
                      >
                        <AddressSummary address={address} />
                      </button>
                    </li>
                  );
                })}
              </ul>
              {addresses.length < MAX_ADDRESSES && (
                <Button type="button" variant="outline" fullWidth onClick={() => setPickerAdding(true)}>+ 새 배송지 추가</Button>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
