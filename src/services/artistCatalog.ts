'use cache';

// 아티스트·멤버·아티스트 배너 조회. 파일 전체가 'use cache'라 내보내는 함수는 모두 캐시됨 (cacheLife는 함수마다).
// 좋아요 함수(artists.ts)를 클라이언트가 import하므로, 캐시 함수는 이 파일에 따로 두고 artists.ts가 다시 내보낸다
import { cacheLife } from 'next/cache';
import { getPublicClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database';
import type { Artist, ArtistMember, ArtistPromoBanner } from '@/types/app';
import { toAppError } from './errors';
import { fallbackArtist, fallbackArtists, warnFallback } from './fallback';
import { getImageUrl } from './storage';

type ArtistRow = Database['public']['Tables']['artists']['Row'];

const toArtist = (a: ArtistRow): Artist => ({
  id: a.id,
  name: a.name,
  nameKo: a.name_ko,
  slug: a.slug,
  logoUrl: getImageUrl('artists', a.logo_path),
  heroImageUrl: getImageUrl('artists', a.hero_image_path),
  themeColor: a.theme_color,
  tagline: a.tagline,
});

export async function getArtists(): Promise<Artist[]> {
  const { data, error } = await getPublicClient().from('artists').select('*').order('sort_order');
  if (error) {
    cacheLife('seconds'); // DB 오류 때 예비 데이터는 짧게만 캐시
    warnFallback('getArtists', error);
    return fallbackArtists();
  }
  cacheLife('minutes');
  return data.map(toArtist);
}

export async function getArtist(slug: string): Promise<Artist | null> {
  const { data, error } = await getPublicClient().from('artists').select('*').eq('slug', slug).maybeSingle();
  if (error) {
    cacheLife('seconds'); // DB 오류 때 예비 데이터는 짧게만 캐시
    warnFallback('getArtist', error);
    return fallbackArtist(slug);
  }
  cacheLife('minutes');
  return data && toArtist(data);
}

// 등록된 배너가 없거나 없는 slug면 빈 배열
export async function getArtistBanners(slug: string): Promise<ArtistPromoBanner[]> {
  cacheLife('minutes');
  const { data, error } = await getPublicClient()
    .from('artist_banners')
    .select('id, title, subtitle, image_path, link_path, artists!inner(slug)')
    .eq('artists.slug', slug)
    .order('sort_order');
  if (error) throw toAppError(error);
  return data.map((b) => ({
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    imageUrl: getImageUrl('artists', b.image_path)!,
    href: b.link_path,
  }));
}

// 없는 slug면 빈 배열
export async function getArtistMembers(slug: string): Promise<ArtistMember[]> {
  cacheLife('minutes');
  const { data, error } = await getPublicClient()
    .from('artist_members')
    .select('*, artists!inner(slug)')
    .eq('artists.slug', slug)
    .order('sort_order');
  if (error) throw toAppError(error);
  return data.map((m) => ({
    id: m.id,
    name: m.name,
    nameEn: m.name_en,
    position: m.position,
    color: m.color,
    mascot: m.mascot,
    birthday: m.birthday,
    mbti: m.mbti,
    description: m.description,
    tags: m.tags,
    imageUrl: getImageUrl('artists', m.image_path),
  }));
}
