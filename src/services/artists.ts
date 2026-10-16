import { createClient, publicClient as supabase } from '@/lib/supabase/client';
import { AppError, toAppError } from './errors';

// 아티스트 조회(캐시됨)는 artistCatalog.ts에 있고 여기서 다시 내보냄. 좋아요 함수는 로그인 사용자별·클라이언트 호출이라 캐시하지 않음
export { getArtist, getArtistBanners, getArtistMembers, getArtists } from './artistCatalog';

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
