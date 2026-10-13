"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { getErrorCode } from "@/constants/error-messages";
import { isWished, toggleWishlist } from "@/services/wishlist";
import { HeartIcon } from "./HeartIcon";

type LoadedLike = { key: string; liked: boolean };

// 상품 좋아요(찜) 버튼. 비로그인이면 로그인 페이지로 보내고, 돌아오면 다시 누를 수 있다.
export function LikeButton({ productId }: { productId: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, initialized } = useAuth();
  const userId = profile?.id ?? null;
  const key = `${userId}:${productId}`;
  const [state, setState] = useState<LoadedLike | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    isWished(productId)
      .then((liked) => active && setState({ key, liked }))
      .catch(() => active && setState({ key, liked: false }));
    return () => {
      active = false;
    };
  }, [key, userId, productId]);

  const liked = userId !== null && state?.key === key && state.liked;

  async function handleClick() {
    if (!userId) return router.push(`/login?next=${encodeURIComponent(pathname)}`);
    setPending(true);
    try {
      setState({ key, liked: await toggleWishlist(productId) });
    } catch (error) {
      if (getErrorCode(error) === "NOT_AUTHENTICATED") router.push(`/login?next=${encodeURIComponent(pathname)}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!initialized || pending}
      aria-pressed={liked}
      aria-label={liked ? "좋아요 취소" : "좋아요"}
      title={liked ? "좋아요 취소" : "좋아요"}
      className={`grid size-10 place-items-center rounded-full border transition-colors disabled:opacity-60 ${liked ? "border-rose-200 bg-rose-50 text-rose-500" : "border-line bg-white text-foreground hover:border-neutral-400"}`}
    >
      <HeartIcon filled={liked} />
    </button>
  );
}
