"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { HeartIcon } from "@/components/product/HeartIcon";
import { useAuth } from "@/components/providers/AuthProvider";
import { getErrorCode, getErrorMessage } from "@/constants/error-messages";
import { getArtistLike, setArtistLiked } from "@/services/artists";

type LoadedLike = { key: string; liked: boolean; count: number; error: string | null };

// 아티스트 좋아요 버튼. 로그인해야 누를 수 있다. 좋아요 수는 메인 배너·아티스트 줄·굿즈 패널 순서(인기순)에 쓰인다.
// initialCount = 서버에서 센 좋아요 수 (내 좋아요 포함)
export function ArtistLikeButton({ slug, name, initialCount }: { slug: string; name: string; initialCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, initialized } = useAuth();
  const userId = profile?.id ?? null;
  const key = `${userId}:${slug}`;
  const [state, setState] = useState<LoadedLike | null>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    getArtistLike(slug)
      .then((row) => active && setState({ key, liked: row.is_liked, count: row.count, error: null }))
      .catch((error) => active && setState({ key, liked: false, count: initialCount, error: getErrorMessage(error) }));
    return () => {
      active = false;
    };
  }, [key, userId, slug, initialCount, retry]);

  const current = userId !== null && state?.key === key ? state : null;
  const liked = current?.liked ?? false;
  const count = current?.count ?? initialCount;

  async function handleClick() {
    if (!userId) return router.push(`/login?next=${encodeURIComponent(pathname)}`);
    if (inFlight.current || !current || current.error) return;
    inFlight.current = true;
    setPending(true);
    try {
      const next = await setArtistLiked(slug, !liked);
      setState((value) => value?.key === key ? { key, liked: next.is_liked, count: next.count, error: null } : value);
    } catch (error) {
      setState((value) => value?.key === key ? { ...value, error: getErrorMessage(error) } : value);
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
      aria-pressed={liked}
      aria-label={liked ? `${name} 좋아요 취소` : `${name} 좋아요`}
      className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-bold transition-colors disabled:opacity-60 ${liked ? "border-rose-200 bg-rose-50 text-rose-500" : "border-line bg-white text-foreground hover:border-neutral-400"}`}
    >
      <HeartIcon filled={liked} />
      <span className="tabular-nums">{count.toLocaleString("ko-KR")}</span>
    </button>
    {current?.error && <p role="alert" className="mt-2 text-xs text-danger">{current.error} <button type="button" className="underline" onClick={() => setRetry((value) => value + 1)}>다시 시도</button></p>}
    </div>
  );
}
