"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HeartIcon } from "@/components/product/HeartIcon";
import { useAuth } from "@/components/providers/AuthProvider";
import { getErrorCode } from "@/constants/error-messages";
import { isArtistLiked, toggleArtistLike } from "@/services/artists";

type LoadedLike = { key: string; liked: boolean; count: number };

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

  useEffect(() => {
    if (!userId) return;
    let active = true;
    isArtistLiked(slug)
      .then((liked) => active && setState({ key, liked, count: initialCount }))
      .catch(() => active && setState({ key, liked: false, count: initialCount }));
    return () => {
      active = false;
    };
  }, [key, userId, slug, initialCount]);

  const current = userId !== null && state?.key === key ? state : null;
  const liked = current?.liked ?? false;
  const count = current?.count ?? initialCount;

  async function handleClick() {
    if (!userId) return router.push(`/login?next=${encodeURIComponent(pathname)}`);
    setPending(true);
    try {
      const next = await toggleArtistLike(slug);
      if (next !== liked) setState({ key, liked: next, count: Math.max(0, count + (next ? 1 : -1)) });
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
      aria-label={liked ? `${name} 좋아요 취소` : `${name} 좋아요`}
      className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-bold transition-colors disabled:opacity-60 ${liked ? "border-rose-200 bg-rose-50 text-rose-500" : "border-line bg-white text-foreground hover:border-neutral-400"}`}
    >
      <HeartIcon filled={liked} />
      <span className="tabular-nums">{count.toLocaleString("ko-KR")}</span>
    </button>
  );
}
