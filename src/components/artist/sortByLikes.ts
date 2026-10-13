// 아티스트를 좋아요 많은 순으로 정렬 (같으면 원래 순서 유지). counts는 getArtistLikeCounts() 결과 { artistId: 개수 }
export function sortByLikes<T extends { id: number }>(artists: T[], counts: Record<number, number>): T[] {
  return [...artists].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0));
}
