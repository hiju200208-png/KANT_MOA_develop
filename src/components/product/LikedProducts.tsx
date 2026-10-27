"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LoginRequired } from "@/components/order/LoginRequired";
import { useAuth } from "@/components/providers/AuthProvider";
import { EmptyState } from "@/components/ui";
import { getErrorMessage } from "@/constants/error-messages";
import { getWishlist } from "@/services/wishlist";
import type { ProductSummary } from "@/types/app";
import { ProductCard } from "./ProductCard";
import { ProductGridSkeleton } from "./ProductGrid";
import { LIKES_CHANGE_EVENT } from "./LikeButton";

type LoadedLikes = { userId: string; items: ProductSummary[]; error: string | null };

// "좋아요" 탭 목록 (최근 좋아요한 순). 로그인 필요
export function LikedProductList() {
  const { profile, initialized } = useAuth();
  const userId = profile?.id ?? null;
  const [state, setState] = useState<LoadedLikes | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    let version = 0;
    const load = () => {
      const current = ++version;
      void getWishlist()
        .then((items) => active && current === version && setState({ userId, items, error: null }))
        .catch((error) => active && current === version && setState({ userId, items: [], error: getErrorMessage(error) }));
    };
    load();
    window.addEventListener(LIKES_CHANGE_EVENT, load);
    return () => {
      active = false;
      window.removeEventListener(LIKES_CHANGE_EVENT, load);
    };
  }, [userId, retry]);

  if (!initialized) return <ProductGridSkeleton />;
  if (!userId) return <LoginRequired next="/recently-viewed?tab=likes" description="로그인하면 좋아요한 상품을 모아 볼 수 있어요." />;
  const current = state?.userId === userId ? state : null;
  if (!current) return <ProductGridSkeleton />;
  if (current.error) return <EmptyState title="좋아요한 상품을 불러오지 못했어요" description={current.error} action={<button type="button" onClick={() => setRetry((value) => value + 1)} className="underline">다시 시도</button>} />;
  if (current.items.length === 0) {
    return (
      <EmptyState
        title="좋아요한 상품이 없어요"
        description="상품 상세에서 하트를 누르면 여기에 모아 둘게요."
        action={
          <Link href="/products" className="inline-flex h-11 items-center rounded-full bg-foreground px-5 text-sm font-bold">
            <span className="text-white">전체 상품 보기</span>
          </Link>
        }
      />
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
      {current.items.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
