import { publicClient as supabase } from '@/lib/supabase/client';
import type { Notice } from '@/types/app';
import { toAppError } from './errors';

const NEW_DAYS = 7; // 게시 후 이 기간 동안 NEW 표시
const COLUMNS = 'id, title, body, product_id, is_pinned, show_in_topbar, published_at, artists(slug)';

type NoticeRow = {
  id: number;
  title: string;
  body: string | null;
  product_id: number | null;
  is_pinned: boolean;
  show_in_topbar: boolean;
  published_at: string;
  artists: { slug: string } | null;
};

const toNotice = (n: NoticeRow): Notice => ({
  id: n.id,
  artistSlug: n.artists?.slug ?? null,
  title: n.title,
  body: n.body ? n.body.split('\n') : [],
  productId: n.product_id,
  isPinned: n.is_pinned,
  showInTopbar: n.show_in_topbar,
  publishedAt: n.published_at,
  isNew: Date.now() - Date.parse(n.published_at) < NEW_DAYS * 24 * 60 * 60 * 1000,
});

// 화면 표시용 게시일 (한국 시간 기준 YYYY.MM.DD)
export function formatNoticeDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(iso)).replaceAll('-', '.');
}

// 상단 고정 먼저, 그다음 최신순. artistSlug가 있으면 그 아티스트 공지만 (전체 공지 제외)
export async function getNotices({ artistSlug, limit = 20 }: { artistSlug?: string; limit?: number } = {}): Promise<Notice[]> {
  let query = supabase
    .from('notices')
    .select(artistSlug ? COLUMNS.replace('artists(slug)', 'artists!inner(slug)') : COLUMNS)
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(limit);
  if (artistSlug) query = query.eq('artists.slug', artistSlug);
  const { data, error } = await query;
  if (error) throw toAppError(error);
  return (data as unknown as NoticeRow[]).map(toNotice);
}

// 공지 하나. artistSlug를 주면 다른 아티스트의 공지 번호로 들어왔을 때 null
export async function getNotice(id: number, artistSlug?: string): Promise<Notice | null> {
  const { data, error } = await supabase.from('notices').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw toAppError(error);
  if (!data) return null;
  const notice = toNotice(data as unknown as NoticeRow);
  return artistSlug && notice.artistSlug !== artistSlug ? null : notice;
}

// 맨 위 검은 공지 띠에 보여줄 공지 1건 (없으면 null)
export async function getTopbarNotice(): Promise<Notice | null> {
  const { data, error } = await supabase
    .from('notices')
    .select(COLUMNS)
    .eq('show_in_topbar', true)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw toAppError(error);
  return data ? toNotice(data as unknown as NoticeRow) : null;
}
