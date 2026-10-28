import type { Artist, ArtistMember, ArtistPromoBanner } from '@/types/app';
import { catalogFetch, CatalogHttpError, publicApiOrigin } from './catalogClient';
import { assetUrl } from './catalogMapping';
import { artistFromApi, type ApiArtist, memberFromApi, type ApiMember } from './catalogMapping';

export async function getArtists(): Promise<Artist[]> {
  return (await catalogFetch<ApiArtist[]>('/artists')).map((row) => artistFromApi(row, publicApiOrigin()));
}
export async function getArtist(slug: string): Promise<Artist | null> {
  try { return artistFromApi(await catalogFetch<ApiArtist>(`/artists/${encodeURIComponent(slug)}`), publicApiOrigin()); }
  catch (error) { if (error instanceof CatalogHttpError && error.status === 404) return null; throw error; }
}
export async function getArtistMembers(slug: string): Promise<ArtistMember[]> {
  return (await catalogFetch<ApiMember[]>(`/artists/${encodeURIComponent(slug)}/members`)).map((row) => memberFromApi(row, publicApiOrigin()));
}
export async function getArtistBanners(slug: string): Promise<ArtistPromoBanner[]> {
  const rows = await catalogFetch<{ id: number; title: string; subtitle: string | null; image_path: string; link_path: string }[]>(`/artists/${encodeURIComponent(slug)}/banners`);
  return rows.map((row) => ({ id:row.id, title:row.title, subtitle:row.subtitle, imageUrl:assetUrl(row.image_path,publicApiOrigin())!, href:row.link_path }));
}
