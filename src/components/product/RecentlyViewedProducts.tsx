"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { EmptyState } from "@/components/ui";
import { getWishedIds } from "@/services/wishlist";
import { publicApiOrigin } from "@/services/catalogClient";
import { isApiImage } from "@/services/catalogMapping";
import type { ProductSummary } from "@/types/app";
import { HeartIcon } from "./HeartIcon";
import { LIKES_CHANGE_EVENT } from "./LikeButton";
import { ProductCard } from "./ProductCard";

const STORAGE_KEY = "kantmoa-recently-viewed";
const CHANGE_EVENT = "kantmoa-recently-viewed-change"; // 같은 탭에서 저장했을 때 알림 (storage 이벤트는 다른 탭에서만 옴)
const MAX_ITEMS = 20;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function parse(stored: string | null): ProductSummary[] {
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ProductSummary => (
      typeof item === "object" && item !== null && typeof (item as ProductSummary).id === "number"
    )).slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

// 최근 본 상품 (최신순). 서버 렌더링과 저장소를 못 쓰는 환경에서는 빈 배열
// 스냅샷은 저장된 문자열이라 내용이 같으면 다시 그리지 않음
export function useRecentlyViewed(): ProductSummary[] {
  const stored = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => parse(stored), [stored]);
}

export function RecentlyViewedTracker({ product }: { product: ProductSummary }) {
  useEffect(() => {
    try {
      const current = parse(readRaw());
      const summary: ProductSummary = {
        id: product.id,
        name: product.name,
        price: product.price,
        status: product.status,
        isSoldOut: product.isSoldOut,
        thumbnailUrl: product.thumbnailUrl,
        artist: product.artist,
        category: product.category,
        isLimited: product.isLimited,
        isPreorder: product.isPreorder,
        releaseDate: product.releaseDate,
        createdAt: product.createdAt,
      };
      const next = [summary, ...current.filter((item) => item.id !== product.id)].slice(0, MAX_ITEMS);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      // 저장소가 차거나 차단돼도 상품 상세 화면은 정상적으로 유지합니다.
    }
  }, [product]);

  return null;
}

// 최근 본 상품 페이지 목록: 저장된 전체 (최대 20개)
export function RecentlyViewedList() {
  const products = useRecentlyViewed();
  if (products.length === 0) {
    return <EmptyState title="최근 본 상품이 없어요" description="상품을 둘러보면 여기에 모아 둘게요." />;
  }
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}

// 칸트봇 버튼 위 동그라미: 가장 최근 본 상품 사진, 누르면 내 상품(최근 본 상품·좋아요) 페이지로.
// 최근 본 상품도 좋아요한 상품도 없으면 숨김. 최근 본 상품 없이 좋아요만 있으면 하트를 보여주고 좋아요 탭으로 이동
// 모바일 bottom = 칸트봇 아래 여백 1rem + 칸트봇 높이(640px 미만 3rem, 이상 3.5rem) + 간격
export function RecentlyViewedButton() {
  const products = useRecentlyViewed();
  const likedCount = useLikedCount();
  const latest = products[0];
  if (!latest && likedCount === 0) return null;

  return (
    <Link
      href={latest ? "/recently-viewed" : "/recently-viewed?tab=likes"}
      aria-label={latest ? `최근 본 상품 ${products.length}개 보기` : `좋아요한 상품 ${likedCount}개 보기`}
      title={latest ? "최근 본 상품" : "좋아요한 상품"}
      className="fixed right-4 bottom-[calc(4.5rem+8px+env(safe-area-inset-bottom))] z-44 block size-12 transition-transform md:size-14 hover:-translate-y-0.5 md:right-6 md:bottom-23"
    >
      <span className="relative grid size-full place-items-center overflow-hidden rounded-full border-2 border-white bg-neutral-100 shadow-[0_12px_30px_-8px_rgb(17_18_20/0.45)]">
        {latest?.thumbnailUrl && <Image src={latest.thumbnailUrl} unoptimized={isApiImage(latest.thumbnailUrl, publicApiOrigin())} alt="" fill sizes="56px" className="object-cover" />}
        {!latest && <HeartIcon filled className="size-6 text-rose-500" />}
      </span>
      <span aria-hidden="true" className="absolute -top-1 -left-1 grid h-5 min-w-5 place-items-center rounded-full bg-neutral-900 px-1 text-[11px] font-bold text-white">
        {latest ? products.length : likedCount}
      </span>
    </Link>
  );
}

type LoadedLikedCount = { userId: string; count: number };

// 로그인한 사용자의 좋아요한 상품 수. 상품 상세에서 좋아요를 누르면(LIKES_CHANGE_EVENT) 다시 센다. 비로그인은 0
function useLikedCount(): number {
  const { profile } = useAuth();
  const userId = profile?.id ?? null;
  const [state, setState] = useState<LoadedLikedCount | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const load = () =>
      getWishedIds()
        .then((ids) => active && setState({ userId, count: ids.length }))
        .catch(() => {});
    load();
    window.addEventListener(LIKES_CHANGE_EVENT, load);
    return () => {
      active = false;
      window.removeEventListener(LIKES_CHANGE_EVENT, load);
    };
  }, [userId]);

  return userId && state?.userId === userId ? state.count : 0;
}
