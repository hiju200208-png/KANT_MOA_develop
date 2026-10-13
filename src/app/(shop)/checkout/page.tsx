"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { AddressPickerModal } from "@/components/address/AddressPickerModal";
import {
  draftToInput,
  emptyDraft,
  formatPhone,
  orderAddressText,
  validateDraft,
  type AddressDraft,
  type AddressDraftErrors,
} from "@/components/address/addressDraft";
import { CheckoutAddressCard } from "@/components/order/CheckoutAddressCard";
import { CheckoutEmpty, DirectUnavailable } from "@/components/order/CheckoutEmpty";
import { CheckoutItems } from "@/components/order/CheckoutItems";
import { CheckoutSteps } from "@/components/order/CheckoutSteps";
import { CheckoutSummary } from "@/components/order/CheckoutSummary";
import { LoginRequired } from "@/components/order/LoginRequired";
import { StepNumber } from "@/components/order/StepNumber";
import { useCheckoutAddresses } from "@/components/order/useCheckoutAddresses";
import { parseDirect, useDirectItem } from "@/components/order/useDirectItem";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card, PageTitle, Skeleton } from "@/components/ui";
import { getErrorCode, getErrorMessage } from "@/constants/error-messages";
import { useCart } from "@/hooks/useCart";
import { useShippingFee } from "@/hooks/useShippingFee";
import { createAddress } from "@/services/addresses";
import { createDirectOrder, createOrder, payOrder } from "@/services/orders";
import type { AddressInput } from "@/types/app";

// cacheComponents 사용 중이라 검색 파라미터를 읽는 클라이언트 컴포넌트는 Suspense로 감싼다.
export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <Checkout />
    </Suspense>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="content-shell py-8 md:py-12">
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function Checkout() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const direct = parseDirect(searchParams);
  const checkoutPath = direct ? `/checkout?variant=${direct.variantId}&qty=${direct.quantity}` : "/checkout";

  const { profile, initialized } = useAuth();
  const cart = useCart();
  const userId = profile?.id ?? null;

  const currentDirect = useDirectItem(direct);
  const directItem = currentDirect?.item ?? null;
  const items = direct ? (directItem ? [directItem] : []) : cart.items;
  const totalQuantity = direct ? (directItem?.quantity ?? 0) : cart.totalQuantity;
  const totalPrice = direct ? (directItem ? directItem.unitPrice * directItem.quantity : 0) : cart.totalPrice;
  const loaded = direct ? currentDirect !== null : cart.loaded;
  const { shippingFee, total } = useShippingFee(totalPrice);

  const { current, reload: reloadAddresses } = useCheckoutAddresses(userId);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // 저장된 배송지가 없을 때 직접 입력하는 칸. 고치기 전에는 프로필 이름·연락처를 기본값으로 보여준다.
  const [draftEdits, setDraftEdits] = useState<AddressDraft | null>(null);
  const [saveNewAddress, setSaveNewAddress] = useState(true);
  const [draftErrors, setDraftErrors] = useState<AddressDraftErrors>({});

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const addresses = current?.addresses ?? [];
  // 기본 배송지는 항상 맨 앞 (docs/API_SPEC.md 5-1장)
  const selected = addresses.find((address) => address.id === selectedId) ?? addresses[0] ?? null;
  const draft =
    draftEdits ?? emptyDraft({ recipientName: profile?.nickname ?? "", recipientPhone: profile?.phone ? formatPhone(profile.phone) : "" });

  async function addFromPicker(input: AddressInput) {
    const created = await createAddress(input);
    await reloadAddresses();
    setSelectedId(created.id);
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
      orderId = direct ? await createDirectOrder(direct.variantId, direct.quantity, recipient) : await createOrder(recipient);
    } catch (error) {
      if (getErrorCode(error) === "NOT_AUTHENTICATED") return router.push(`/login?next=${encodeURIComponent(checkoutPath)}`);
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
    // 장바구니 주문은 결제된 상품이 서버에서 장바구니에서 빠지므로 다시 불러온다. (바로 구매는 장바구니 그대로)
    if (!direct) await cart.refresh().catch(() => {});
    router.push(`/orders/${orderId}`);
  }

  if (!initialized || !loaded || (userId && !current)) {
    return <CheckoutSkeleton />;
  }

  if (!profile) {
    return (
      <div className="content-shell py-8 md:py-12">
        <PageTitle title="주문서" />
        <LoginRequired
          next={checkoutPath}
          description={direct ? "로그인하면 선택한 상품을 바로 주문할 수 있어요." : "로그인하면 담아둔 상품이 그대로 장바구니에 남아 있어요."}
        />
      </div>
    );
  }

  if (direct && !submitting && (!directItem || !directItem.isAvailable)) {
    return <DirectUnavailable item={directItem} error={currentDirect?.error ?? null} />;
  }

  if (items.length === 0 && !submitting) {
    return <CheckoutEmpty />;
  }

  return (
    <div className="content-shell py-8 md:py-12">
      <CheckoutSteps current={1} direct={direct !== null} />
      <PageTitle title="주문서" description="배송 정보를 확인하고 결제해주세요." />
      <form onSubmit={handleSubmit} noValidate className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-6">
          <CheckoutAddressCard
            selected={selected}
            loadError={current?.error ?? null}
            draft={draft}
            draftErrors={draftErrors}
            onDraftChange={setDraftEdits}
            saveNewAddress={saveNewAddress}
            onSaveNewAddressChange={setSaveNewAddress}
            onOpenPicker={() => setPickerOpen(true)}
          />
          <Card className="px-6">
            <h2 className="flex items-center gap-2 pt-6 text-lg font-black">
              <StepNumber n={2} />
              주문 상품 {totalQuantity}개
            </h2>
            <CheckoutItems items={items} />
          </Card>
        </div>
        <CheckoutSummary totalPrice={totalPrice} shippingFee={shippingFee} total={total} submitError={submitError} submitting={submitting} />
      </form>

      <AddressPickerModal
        open={pickerOpen}
        addresses={addresses}
        selectedId={selected?.id ?? null}
        newDraft={emptyDraft({ recipientName: profile.nickname, recipientPhone: profile.phone ? formatPhone(profile.phone) : "" })}
        onSelect={(id) => {
          setSelectedId(id);
          setPickerOpen(false);
        }}
        onAdd={addFromPicker}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}
