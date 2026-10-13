"use client";

import { useEffect, useState } from "react";
import { getErrorMessage } from "@/constants/error-messages";
import { getAddresses } from "@/services/addresses";
import type { Address } from "@/types/app";

// 결과를 사용자 id와 함께 보관해서, 다른 계정으로 바뀌면 이전 주소를 쓰지 않는다.
type LoadedAddresses = { userId: string; addresses: Address[]; error: string | null };

// 주문서의 저장된 배송지. current가 null이면 아직 불러오는 중이다.
export function useCheckoutAddresses(userId: string | null) {
  const [state, setState] = useState<LoadedAddresses | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    getAddresses()
      .then((addresses) => active && setState({ userId, addresses, error: null }))
      .catch((error) => active && setState({ userId, addresses: [], error: getErrorMessage(error) }));
    return () => {
      active = false;
    };
  }, [userId]);

  async function reload() {
    if (userId) setState({ userId, addresses: await getAddresses(), error: null });
  }

  return { current: state?.userId === userId ? state : null, reload };
}
