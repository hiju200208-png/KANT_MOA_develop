import { apiFetch, getAccessToken } from './api';
import { catalogFetch } from './catalogClient';
export { getArtist, getArtistBanners, getArtistMembers, getArtists } from './artistCatalog';

export type ArtistLikeState = { artist_id: number; is_liked: boolean; count: number };
export async function getArtistLikeCounts(): Promise<Record<number, number>> {
  return catalogFetch<Record<number, number>>('/artists/like-counts');
}
export async function getArtistLike(slug: string): Promise<ArtistLikeState> {
  return apiFetch<ArtistLikeState>(`/artists/${encodeURIComponent(slug)}/like`);
}
export async function isArtistLiked(slug: string): Promise<boolean> {
  return getAccessToken() ? (await getArtistLike(slug)).is_liked : false;
}
export async function setArtistLiked(slug: string, liked: boolean): Promise<ArtistLikeState> {
  return apiFetch<ArtistLikeState>(`/artists/${encodeURIComponent(slug)}/like`, { method: liked ? 'PUT' : 'DELETE' });
}
