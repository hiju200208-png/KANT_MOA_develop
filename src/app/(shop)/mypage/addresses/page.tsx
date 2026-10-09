"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AddressForm } from "@/components/address/AddressForm";
import { AddressSummary } from "@/components/address/AddressSummary";
import { MAX_ADDRESSES, draftFromAddress, emptyDraft } from "@/components/address/addressDraft";
import { LoginRequired } from "@/components/order/LoginRequired";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button, Card, EmptyState, SectionHeader, Skeleton } from "@/components/ui";
import { getErrorMessage } from "@/constants/error-messages";
import { createAddress, deleteAddress, getAddresses, setDefaultAddress, updateAddress } from "@/services/addresses";
import type { Address, AddressInput } from "@/types/app";

// 결과를 사용자 id와 함께 보관해서, 다른 계정으로 바뀌면 이전 목록을 보여주지 않는다.
type Loaded = { userId: string; addresses: Address[] | null; error: string | null };
type Mode = { type: "list" } | { type: "add" } | { type: "edit"; address: Address };

export default function AddressesPage() {
  const { profile, initialized } = useAuth();
  const userId = profile?.id ?? null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [mode, setMode] = useState<Mode>({ type: "list" });
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    getAddresses()
      .then((addresses) => active && setLoaded({ userId, addresses, error: null }))
      .catch((error) => active && setLoaded({ userId, addresses: null, error: getErrorMessage(error) }));
    return () => {
      active = false;
    };
  }, [userId]);

  async function reload() {
    if (!userId) return;
    setLoaded({ userId, addresses: await getAddresses(), error: null });
  }

  // 폼 저장: 실패하면 AddressForm이 에러를 보여주도록 그대로 던진다.
  async function save(action: () => Promise<unknown>) {
    await action();
    await reload();
    setMode({ type: "list" });
  }

  async function run(id: number, action: () => Promise<void>) {
    setBusyId(id);
    setActionError(null);
    try {
      await action();
      await reload();
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
    setBusyId(null);
  }

  const current = loaded?.userId === userId ? loaded : null;
  const addresses = current?.addresses ?? [];

  let body;
  if (!initialized || (userId && !current)) {
    body = (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  } else if (!userId) {
    body = <LoginRequired next="/mypage/addresses" />;
  } else if (current?.error) {
    body = <p role="alert" className="text-sm text-danger">{current.error}</p>;
  } else if (mode.type !== "list") {
    const editing = mode.type === "edit" ? mode.address : null;
    body = (
      <Card className="p-6">
        <h2 className="mb-5 text-lg font-black">{editing ? "배송지 수정" : "새 배송지 추가"}</h2>
        <AddressForm
          initial={editing ? draftFromAddress(editing) : emptyDraft({ recipientName: profile?.nickname ?? "", recipientPhone: profile?.phone ?? "" })}
          showDefaultOption={!editing?.isDefault && addresses.length > 0}
          submitLabel="저장"
          onCancel={() => setMode({ type: "list" })}
          onSubmit={(input: AddressInput) => save(() => (editing ? updateAddress(editing.id, input) : createAddress(input)))}
        />
      </Card>
    );
  } else if (addresses.length === 0) {
    body = (
      <EmptyState
        title="저장된 배송지가 없어요"
        description="배송지를 저장해두면 주문서에 자동으로 입력돼요. 주문할 때 입력한 주소도 저장할 수 있어요."
        action={<Button onClick={() => setMode({ type: "add" })}>새 배송지 추가</Button>}
      />
    );
  } else {
    body = (
      <div className="space-y-4">
        {actionError && <p role="alert" className="text-sm text-danger">{actionError}</p>}
        <ul className="space-y-4">
          {addresses.map((address) => (
            <li key={address.id}>
              <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                <AddressSummary address={address} />
                <div className="flex shrink-0 flex-wrap gap-2">
                  {!address.isDefault && (
                    <Button variant="outline" size="sm" disabled={busyId !== null} loading={busyId === address.id} onClick={() => run(address.id, () => setDefaultAddress(address.id))}>
                      기본으로 설정
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" disabled={busyId !== null} onClick={() => setMode({ type: "edit", address })}>수정</Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId !== null}
                    className="text-danger hover:bg-red-50"
                    onClick={() => {
                      const message = address.isDefault
                        ? "기본 배송지를 삭제하면 가장 최근 주소가 기본 배송지가 돼요. 삭제할까요?"
                        : "이 배송지를 삭제할까요?";
                      if (window.confirm(message)) run(address.id, () => deleteAddress(address.id));
                    }}
                  >
                    삭제
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
        {addresses.length < MAX_ADDRESSES ? (
          <Button variant="outline" fullWidth onClick={() => setMode({ type: "add" })}>+ 새 배송지 추가</Button>
        ) : (
          <p className="text-center text-sm text-muted">배송지는 최대 {MAX_ADDRESSES}개까지 저장할 수 있어요.</p>
        )}
      </div>
    );
  }

  return (
    <div className="content-shell max-w-3xl py-8 md:py-12">
      <Link href="/mypage" className="brand-gradient-text-hover mb-4 inline-flex min-h-11 items-center text-sm font-bold text-muted">
        <span aria-hidden="true">‹</span>&nbsp;마이페이지
      </Link>
      <SectionHeader title="배송 주소 관리" />
      {body}
    </div>
  );
}
