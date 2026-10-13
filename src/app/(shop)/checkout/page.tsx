"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { AddressFields } from "@/components/address/AddressFields";
import { AddressPickerModal } from "@/components/address/AddressPickerModal";
import { AddressSummary } from "@/components/address/AddressSummary";
import {
  draftToInput,
  emptyDraft,
  formatPhone,
  orderAddressText,
  validateDraft,
  type AddressDraft,
  type AddressDraftErrors,
} from "@/components/address/addressDraft";
import { CheckoutItems } from "@/components/order/CheckoutItems";
import { CheckoutSteps } from "@/components/order/CheckoutSteps";
import { LoginRequired } from "@/components/order/LoginRequired";
import { PageTitle } from "@/components/order/PageTitle";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button, Card, EmptyState, Skeleton } from "@/components/ui";
import { getErrorCode, getErrorMessage } from "@/constants/error-messages";
import { useCart } from "@/hooks/useCart";
import { useShippingFee } from "@/hooks/useShippingFee";
import { createAddress, getAddresses } from "@/services/addresses";
import { getDirectItem } from "@/services/cart";
import { createDirectOrder, createOrder, payOrder } from "@/services/orders";
import type { Address, AddressInput, CartItem } from "@/types/app";

// 결과를 사용자 id와 함께 보관해서, 다른 계정으로 바뀌면 이전 주소를 쓰지 않는다.
type LoadedAddresses = { userId: string; addresses: Address[]; error: string | null };

// 바로 구매: /checkout?variant=12&qty=2. variant가 없으면 장바구니 전체를 주문한다.
type DirectBuy = { variantId: number; quantity: number };
type LoadedDirect = { key: string; item: CartItem | null; error: string | null };

function parseDirect(params: URLSearchParams): DirectBuy | null {
  const variantId = Number(params.get("variant"));
  if (!Number.isInteger(variantId) || variantId <= 0) return null;
  const quantity = Number(params.get("qty") ?? 1);
  return { variantId, quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : 1 };
}

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
  const directKey = direct ? `${direct.variantId}:${direct.quantity}` : null;
  const checkoutPath = direct ? `/checkout?variant=${direct.variantId}&qty=${direct.quantity}` : "/checkout";

  const { profile, initialized } = useAuth();
  const cart = useCart();
  const userId = profile?.id ?? null;

  const [directState, setDirectState] = useState<LoadedDirect | null>(null);
  useEffect(() => {
    if (!direct || !directKey) return;
    let active = true;
    getDirectItem(direct.variantId, direct.quantity)
      .then((item) => active && setDirectState({ key: directKey, item, error: null }))
      .catch((error) => active && setDirectState({ key: directKey, item: null, error: getErrorMessage(error) }));
    return () => {
      active = false;
    };
    // directKey가 같으면 direct도 같은 값이다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directKey]);

  const currentDirect = directState?.key === directKey ? directState : null;
  const directItem = currentDirect?.item ?? null;
  const items = direct ? (directItem ? [directItem] : []) : cart.items;
  const totalQuantity = direct ? (directItem?.quantity ?? 0) : cart.totalQuantity;
  const totalPrice = direct ? (directItem ? directItem.unitPrice * directItem.quantity : 0) : cart.totalPrice;
  const loaded = direct ? currentDirect !== null : cart.loaded;
  const { shippingFee, total } = useShippingFee(totalPrice);

  const [addressState, setAddressState] = useState<LoadedAddresses | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

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
    return (
      <div className="content-shell py-8 md:py-12">
        <EmptyState
          title="지금은 구매할 수 없는 상품이에요"
          description={currentDirect?.error ?? (directItem ? "판매가 중지되었거나 재고가 부족해요." : "상품을 찾을 수 없어요.")}
          action={
            <Link href={directItem ? `/products/${directItem.product.id}` : "/"}>
              <Button>{directItem ? "상품으로 돌아가기" : "홈으로 가기"}</Button>
            </Link>
          }
        />
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
      <CheckoutSteps current={1} direct={direct !== null} />
      <PageTitle title="주문서" description="배송 정보를 확인하고 결제해주세요." />
      <form onSubmit={handleSubmit} noValidate className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-6">
          <Card className="space-y-5 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="flex items-center gap-2 text-lg font-black">
                <StepNumber n={1} />
                배송지
              </h2>
              {selected && (
                <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>배송지 변경</Button>
              )}
            </div>
            {current?.error && <p className="text-sm text-danger">저장된 배송지를 불러오지 못했어요. 이번 주문은 직접 입력해주세요.</p>}
            {selected ? (
              <div className="rounded-md bg-neutral-50 p-4">
                <AddressSummary address={selected} />
              </div>
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
            <h2 className="flex items-center gap-2 pt-6 text-lg font-black">
              <StepNumber n={2} />
              주문 상품 {totalQuantity}개
            </h2>
            <CheckoutItems items={items} />
          </Card>
        </div>

        <Card className="p-6 lg:sticky lg:top-24">
          <h2 className="flex items-center gap-2 text-lg font-black">
            <StepNumber n={3} />
            결제 금액
          </h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted">상품 금액</dt><dd className="font-bold tabular-nums">{totalPrice.toLocaleString("ko-KR")}원</dd></div>
            <div className="flex justify-between"><dt className="text-muted">배송비</dt><dd className="font-bold tabular-nums">{shippingFee === 0 ? "무료" : `${shippingFee.toLocaleString("ko-KR")}원`}</dd></div>
            <div className="flex items-baseline justify-between border-t border-line pt-4">
              <dt className="font-bold">총 결제 금액</dt>
              <dd className="text-2xl font-black tabular-nums">{total.toLocaleString("ko-KR")}원</dd>
            </div>
          </dl>
          <p className="mt-4 rounded-lg bg-brand-soft px-3 py-2 text-xs leading-5 text-brand-strong">실제 결제는 이루어지지 않는 테스트 결제예요. 최종 금액은 주문 시 서버에서 다시 계산돼요.</p>
          {submitError && <p role="alert" className="mt-4 text-sm text-danger">{submitError}</p>}
          <Button type="submit" fullWidth size="lg" className="mt-6" loading={submitting}>
            {total.toLocaleString("ko-KR")}원 결제하기
          </Button>
        </Card>
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

function StepNumber({ n }: { n: number }) {
  return (
    <span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-foreground text-xs text-white">
      {n}
    </span>
  );
}
