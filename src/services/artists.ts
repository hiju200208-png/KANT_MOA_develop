import { createClient, publicClient as supabase } from '@/lib/supabase/client';
import type { Database } from '@/types/database';
import type { Artist, ArtistMember, ArtistPromoBanner } from '@/types/app';
import { AppError, toAppError } from './errors';
import { fallbackArtist, fallbackArtists, warnFallback } from './fallback';
import { getImageUrl } from './storage';

// 아티스트·멤버·아티스트 배너 조회 (상품·카테고리는 products.ts)
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
  const { data, error } = await supabase.from('artists').select('*').order('sort_order');
  if (error) {
    warnFallback('getArtists', error);
    return fallbackArtists();
  }
  return data.map(toArtist);
}

export async function getArtist(slug: string): Promise<Artist | null> {
  const { data, error } = await supabase.from('artists').select('*').eq('slug', slug).maybeSingle();
  if (error) {
    warnFallback('getArtist', error);
    return fallbackArtist(slug);
  }
  return data && toArtist(data);
}

// 등록된 배너가 없거나 없는 slug면 빈 배열
export async function getArtistBanners(slug: string): Promise<ArtistPromoBanner[]> {
  const { data, error } = await supabase
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
  const { data, error } = await supabase
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

// ── 아티스트 좋아요 ──────────────────────────────────────────────

// 아티스트별 좋아요 수 { artistId: 개수 }. 비로그인도 조회 가능, 좋아요가 0인 아티스트는 키가 없음 (화면에서 ?? 0)
export async function getArtistLikeCounts(): Promise<Record<number, number>> {
  const { data, error } = await supabase.rpc('get_artist_like_counts');
  if (error) throw toAppError(error);
  return Object.fromEntries(data.map((row) => [row.artist_id, row.like_count]));
}

// 내가 좋아요한 아티스트인지. 비로그인은 false
export async function isArtistLiked(slug: string): Promise<boolean> {
  const client = createClient();
  const { data: session } = await client.auth.getSession();
  if (!session.session) return false;
  const { data, error } = await client
    .from('artist_likes')
    .select('artist_id, artists!inner(slug)')
    .eq('artists.slug', slug)
    .limit(1);
  if (error) throw toAppError(error);
  return data.length > 0;
}

// 좋아요 ↔ 취소. 바뀐 뒤 상태를 돌려줌 (true = 좋아요함). 로그인 필요 (비로그인은 NOT_AUTHENTICATED)
export async function toggleArtistLike(slug: string): Promise<boolean> {
  const client = createClient();
  const { data: session } = await client.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) throw new AppError('NOT_AUTHENTICATED');

  const { data: artist, error: artistError } = await client.from('artists').select('id').eq('slug', slug).maybeSingle();
  if (artistError) throw toAppError(artistError);
  if (!artist) throw new AppError('UNKNOWN', `없는 아티스트: ${slug}`);

  const { data: removed, error } = await client
    .from('artist_likes')
    .delete()
    .eq('artist_id', artist.id)
    .select('artist_id');
  if (error) throw toAppError(error);
  if (removed.length > 0) return false;

  const { error: insertError } = await client.from('artist_likes').insert({ user_id: userId, artist_id: artist.id });
  if (insertError && insertError.code !== '23505') throw toAppError(insertError); // 23505: 다른 탭에서 이미 좋아요함
  return true;
}
