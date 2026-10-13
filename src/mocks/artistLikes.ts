// TODO(mock): 아티스트 좋아요 (backend-request 이슈). 백엔드에 artist_likes 테이블·집계 함수가 생기면
// services의 getArtistLikeCounts / isArtistLiked / toggleArtistLike로 교체하고 이 파일은 삭제한다.
// 지금은 인기 순서를 보여주기 위한 고정 숫자 + 이 브라우저에만 저장되는 내 좋아요 상태다.

const BASE_COUNTS: Record<string, number> = {
  bts: 1280,
  seventeen: 1140,
  "le-sserafim": 980,
  txt: 870,
  boynextdoor: 760,
  tws: 690,
  cortis: 640,
  zico: 520,
  "orbit-on": 310,
  daylog: 270,
  sodafm: 240,
};

const STORAGE_KEY = "kantmoa-mock-artist-likes";
export const ARTIST_LIKE_CHANGE_EVENT = "kantmoa-artist-like-change";

// 아티스트별 좋아요 수 (서버·브라우저 공용). 없는 아티스트는 0
export function getArtistLikeCount(slug: string): number {
  return BASE_COUNTS[slug] ?? 0;
}

// 좋아요 많은 순으로 정렬 (같으면 원래 순서 유지)
export function sortByArtistLikes<T extends { slug: string }>(artists: T[]): T[] {
  return [...artists].sort((a, b) => getArtistLikeCount(b.slug) - getArtistLikeCount(a.slug));
}

// 이 브라우저에서 좋아요한 아티스트 slug 목록을 문자열 그대로 (useSyncExternalStore 스냅샷용)
export function readLikedArtistsRaw(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

export function parseLikedArtists(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

// 좋아요 ↔ 취소. 바뀐 뒤 상태를 돌려줌 (true = 좋아요)
export function toggleArtistLikeMock(slug: string): boolean {
  const liked = parseLikedArtists(readLikedArtistsRaw());
  const next = liked.includes(slug) ? liked.filter((s) => s !== slug) : [...liked, slug];
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(ARTIST_LIKE_CHANGE_EVENT));
  } catch {
    // 저장소를 쓸 수 없으면 상태가 유지되지 않을 뿐 화면은 그대로 둔다.
  }
  return next.includes(slug);
}
