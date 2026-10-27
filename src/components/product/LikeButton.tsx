"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { getErrorCode, getErrorMessage } from "@/constants/error-messages";
import { isWished, setWished } from "@/services/wishlist";
import { HeartIcon } from "./HeartIcon";

type LoadedLike = { key: string; liked: boolean; error: string | null };

// 좋아요가 바뀌었다고 알림 (오른쪽 아래 최근 본 상품 버튼이 좋아요 수를 다시 셈)
export const LIKES_CHANGE_EVENT = "kantmoa-likes-change";

// 상품 좋아요(찜) 버튼. 비로그인이면 로그인 페이지로 보내고, 돌아오면 다시 누를 수 있다.
export function LikeButton({ productId }: { productId: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, initialized } = useAuth();
  const userId = profile?.id ?? null;
  const key = `${userId}:${productId}`;
  const [state, setState] = useState<LoadedLike | null>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    isWished(productId)
      .then((liked) => active && setState({ key, liked, error: null }))
      .catch((error) => active && setState({ key, liked: false, error: getErrorMessage(error) }));
    return () => {
      active = false;
    };
  }, [key, userId, productId, retry]);

  const current = userId !== null && state?.key === key ? state : null;
  const liked = current?.liked ?? false;

  async function handleClick() {
    if (!userId) return router.push(`/login?next=${encodeURIComponent(pathname)}`);
    if (inFlight.current || !current || current.error) return;
    inFlight.current = true;
    setPending(true);
    const next = !liked;
    setState({ key, liked: next, error: null });
    try {
      const saved = await setWished(productId, next);
      setState((value) => value?.key === key ? { key, liked: saved, error: null } : value);
      window.dispatchEvent(new Event(LIKES_CHANGE_EVENT));
    } catch (error) {
      setState((value) => value?.key === key ? { key, liked, error: getErrorMessage(error) } : value);
      if (getErrorCode(error) === "NOT_AUTHENTICATED") router.push(`/login?next=${encodeURIComponent(pathname)}`);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <div>
    <button
      type="button"
      onClick={handleClick}
      disabled={!initialized || pending || (userId !== null && (!current || current.error !== null))}
      aria-busy={pending || (userId !== null && !current)}
      aria-pressed={liked}
      aria-label={liked ? "좋아요 취소" : "좋아요"}
      title={liked ? "좋아요 취소" : "좋아요"}
      className={`grid size-10 place-items-center rounded-full border transition-colors disabled:opacity-60 ${liked ? "border-rose-200 bg-rose-50 text-rose-500" : "border-line bg-white text-foreground hover:border-neutral-400"}`}
    >
      <HeartIcon filled={liked} />
    </button>
    {current?.error && <p role="alert" className="mt-2 max-w-48 text-xs text-danger">{current.error} <button type="button" onClick={() => setRetry((value) => value + 1)} className="underline">다시 시도</button></p>}
    </div>
  );
}
