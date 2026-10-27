import { cacheLife } from 'next/cache';
import { getPublicClient } from '@/lib/supabase/client';
import type { BestProduct, HomeBanner } from '@/types/app';
import { toAppError } from './errors';
import { getImageUrl } from './storage';
import { SUMMARY_COLUMNS, toSummary, type SummaryRow } from './productRows';

// 8단계 이전까지 유지하는 기존 인기순·배너 호출. 상품 조회에서 이 모듈을 eager import하지 않는다.

// 인기 순위: 최근 days일 결제 수량 순, 판매가 없으면 최신순으로 채움 (RPC get_best_products)
export async function getBestProducts({
  days = 7,
  limit = 8,
  artistSlug,
}: { days?: number; limit?: number; artistSlug?: string } = {}): Promise<BestProduct[]> {
  'use cache';
  cacheLife('minutes');
  const { data: ranks, error } = await getPublicClient().rpc('get_best_products', {
    days,
    limit_count: limit,
    artist_slug: artistSlug,
  });
  if (error) throw toAppError(error);
  if (ranks.length === 0) return [];

  const { data, error: productError } = await getPublicClient()
    .from('products')
    .select(SUMMARY_COLUMNS)
    .in('id', ranks.map((r) => r.product_id));
  if (productError) throw toAppError(productError);

  const byId = new Map((data as SummaryRow[]).map((p) => [p.id, p]));
  return ranks.flatMap((r) => {
    const row = byId.get(r.product_id);
    return row ? [{ ...toSummary(row), rank: r.rank }] : [];
  });
}

// 메인 기획전 배너: 활성 + 노출 기간 안, sort_order 순
export async function getHomeBanners(): Promise<{ main: HomeBanner[]; side: HomeBanner[] }> {
  'use cache';
  cacheLife('minutes');
  const { data: rows, error } = await getPublicClient()
    .from('home_banners')
    .select('id, slot, eyebrow, title, subtitle, badge, image_path, link_path, starts_at, ends_at')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw toAppError(error);

  // 노출 기간은 행이 몇 개 안 돼서 여기서 거름
  const now = Date.now();
  const data = rows.filter(
    (b) => (!b.starts_at || Date.parse(b.starts_at) <= now) && (!b.ends_at || Date.parse(b.ends_at) > now),
  );

  const toBanner = (b: (typeof data)[number]): HomeBanner => ({
    id: b.id,
    eyebrow: b.eyebrow,
    title: b.title,
    subtitle: b.subtitle,
    badge: b.badge,
    imageUrl: getImageUrl('artists', b.image_path)!,
    href: b.link_path,
  });
  return {
    main: data.filter((b) => b.slot === 'main').map(toBanner),
    side: data.filter((b) => b.slot === 'side').map(toBanner),
  };
}
