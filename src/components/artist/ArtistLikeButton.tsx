"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo, useSyncExternalStore } from "react";
import { HeartIcon } from "@/components/product/HeartIcon";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  ARTIST_LIKE_CHANGE_EVENT,
  getArtistLikeCount,
  parseLikedArtists,
  readLikedArtistsRaw,
  toggleArtistLikeMock,
} from "@/mocks/artistLikes";

function subscribe(onChange: () => void) {
  window.addEventListener(ARTIST_LIKE_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(ARTIST_LIKE_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// 아티스트 좋아요 버튼. 로그인해야 누를 수 있다. 좋아요 수는 메인 배너 순서(인기순)에 쓰인다.
// TODO(mock): 아티스트 좋아요 백엔드가 생기면 services 함수로 교체
export function ArtistLikeButton({ slug, name }: { slug: string; name: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useAuth();
  const raw = useSyncExternalStore(subscribe, readLikedArtistsRaw, () => "[]");
  const liked = useMemo(() => profile !== null && parseLikedArtists(raw).includes(slug), [profile, raw, slug]);
  const count = getArtistLikeCount(slug) + (liked ? 1 : 0);

  function handleClick() {
    if (!profile) return router.push(`/login?next=${encodeURIComponent(pathname)}`);
    toggleArtistLikeMock(slug);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={liked}
      aria-label={liked ? `${name} 좋아요 취소` : `${name} 좋아요`}
      className={`inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-bold transition-colors ${liked ? "border-rose-200 bg-rose-50 text-rose-500" : "border-line bg-white text-foreground hover:border-neutral-400"}`}
    >
      <HeartIcon filled={liked} />
      <span className="tabular-nums">{count.toLocaleString("ko-KR")}</span>
    </button>
  );
}
