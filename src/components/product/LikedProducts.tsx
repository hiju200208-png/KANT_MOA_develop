"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LoginRequired } from "@/components/order/LoginRequired";
import { useAuth } from "@/components/providers/AuthProvider";
import { EmptyState } from "@/components/ui";
import { getErrorMessage } from "@/constants/error-messages";
import { getWishlist } from "@/services/wishlist";
import type { ProductSummary } from "@/types/app";
import { HeartIcon } from "./HeartIcon";
import { ProductCard } from "./ProductCard";
import { ProductGridSkeleton } from "./ProductGrid";

type LoadedLikes = { userId: string; items: ProductSummary[]; error: string | null };

// 좋아요한 상품 페이지 목록 (최근 좋아요한 순). 로그인 필요
export function LikedProductList() {
  const { profile, initialized } = useAuth();
  const userId = profile?.id ?? null;
  const [state, setState] = useState<LoadedLikes | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    getWishlist()
      .then((items) => active && setState({ userId, items, error: null }))
      .catch((error) => active && setState({ userId, items: [], error: getErrorMessage(error) }));
    return () => {
      active = false;
    };
  }, [userId]);

  if (!initialized) return <ProductGridSkeleton />;
  if (!userId) return <LoginRequired next="/likes" description="로그인하면 좋아요한 상품을 모아 볼 수 있어요." />;
  const current = state?.userId === userId ? state : null;
  if (!current) return <ProductGridSkeleton />;
  if (current.error) return <EmptyState title="좋아요한 상품을 불러오지 못했어요" description={current.error} />;
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

// 오른쪽 아래 최근 본 상품 동그라미 옆의 하트 버튼. 누르면 좋아요한 상품 페이지로
export function LikedProductsButton() {
  return (
    <Link
      href="/likes"
      aria-label="좋아요한 상품 보기"
      title="좋아요한 상품"
      className="grid size-12 place-items-center rounded-full border-2 border-white bg-white shadow-[0_12px_30px_-8px_rgb(17_18_20/0.45)] transition-transform hover:-translate-y-0.5 md:size-14"
    >
      <HeartIcon filled className="size-6 text-rose-500" />
    </Link>
  );
}
