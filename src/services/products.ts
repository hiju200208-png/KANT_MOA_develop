import { cacheLife } from 'next/cache';
import { publicClient as supabase } from '@/lib/supabase/client';
import type {
  BestProduct,
  Category,
  HomeBanner,
  ProductDetail,
  ProductList,
  ProductQuery,
  SearchQuery,
} from '@/types/app';
import { toAppError } from './errors';
import {
  fallbackCategories,
  fallbackProduct,
  fallbackProducts,
  warnFallback,
} from './fallback';
import { getImageUrl } from './storage';
import { BASE_COLUMNS, SUMMARY_COLUMNS, toSummary, type SummaryRow } from './productRows';

// 카탈로그 조회는 'use cache' + cacheLife('minutes'): 1분마다 백그라운드 갱신, 빌드 때 정적 뼈대에도 포함됨.
// 매 방문마다 DB에 가지 않아 첫 화면이 빨라진다. 검색(searchProducts)은 검색어마다 달라 캐시하지 않음

export async function getCategories(): Promise<Category[]> {
  'use cache';
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug')
    .order('sort_order');
  if (error) {
    cacheLife('seconds'); // DB 오류 때 예비 데이터는 짧게만 캐시
    warnFallback('getCategories', error);
    return fallbackCategories();
  }
  cacheLife('minutes');
  return data;
}


export async function getProducts({
  artistSlug,
  categorySlug,
  sort = 'latest',
  limit = 20,
  offset = 0,
  excludeId,
}: ProductQuery = {}): Promise<ProductList> {
  'use cache';
  let query = supabase.from('products').select(SUMMARY_COLUMNS, { count: 'exact' });
  if (artistSlug) query = query.eq('artists.slug', artistSlug);
  if (categorySlug) query = query.eq('categories.slug', categorySlug);
  if (excludeId) query = query.neq('id', excludeId);
  query =
    sort === 'latest'
      ? query.order('created_at', { ascending: false }).order('id', { ascending: false })
      : query.order('price', { ascending: sort === 'price_asc' }).order('id');

  const { data, count, error } = await query.range(offset, offset + limit - 1);
  if (error) {
    cacheLife('seconds'); // DB 오류 때 예비 데이터는 짧게만 캐시
    warnFallback('getProducts', error);
    return fallbackProducts({ artistSlug, categorySlug, sort, limit, offset, excludeId });
  }
  cacheLife('minutes');
  return { items: (data as SummaryRow[]).map(toSummary), total: count ?? 0 };
}

export async function getProduct(id: number): Promise<ProductDetail | null> {
  'use cache';
  const { data, error } = await supabase
    .from('products')
    .select(
      `${BASE_COLUMNS}, description, product_images(image_path, sort_order, kind), product_variants(id, option_name, extra_price, stock, max_per_user, sort_order)`,
    )
    .eq('id', id)
    .maybeSingle();
  if (error) {
    cacheLife('seconds'); // DB 오류 때 예비 데이터는 짧게만 캐시
    warnFallback('getProduct', error);
    return fallbackProduct(id);
  }
  cacheLife('minutes');
  if (!data) return null;

  const row = data as unknown as SummaryRow & {
    description: string | null;
    product_images: { image_path: string; sort_order: number; kind: string }[];
    product_variants: {
      id: number;
      option_name: string;
      extra_price: number;
      stock: number;
      max_per_user: number | null;
      sort_order: number;
    }[];
  };
  const variants = [...row.product_variants]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((v) => ({
      id: v.id,
      optionName: v.option_name,
      extraPrice: v.extra_price,
      price: row.price + v.extra_price,
      stock: v.stock,
      maxPerUser: v.max_per_user,
      isSoldOut: v.stock === 0,
    }));

  const images = [...row.product_images].sort((a, b) => a.sort_order - b.sort_order);
  const urlsOf = (kind: string) => images.filter((i) => i.kind === kind).map((i) => getImageUrl('products', i.image_path)!);
  const detailUrls = urlsOf('detail');
  return {
    ...toSummary(row),
    description: row.description,
    imageUrls: detailUrls,
    galleryUrls: urlsOf('gallery'),
    detailUrls,
    variants,
    hasOptions: !(variants.length === 1 && variants[0].optionName === '기본'),
  };
}

// 상품명·아티스트명(영문·한글) 부분 일치, 최신순. 검색어의 특수문자(% _ , ( ) * \\)는 공백으로 바꿈
export async function searchProducts({ q, limit = 20, offset = 0 }: SearchQuery): Promise<ProductList> {
  const keyword = q.replace(/[%_,()*\\]/g, ' ').trim();
  if (!keyword) return { items: [], total: 0 };

  const pattern = `%${keyword}%`;
  const { data: artists, error: artistError } = await supabase
    .from('artists')
    .select('id')
    .or(`name.ilike.${pattern},name_ko.ilike.${pattern}`);
  if (artistError) throw toAppError(artistError);

  const artistIds = artists.map((a) => a.id);
  const filter = artistIds.length > 0 ? `name.ilike.${pattern},artist_id.in.(${artistIds.join(',')})` : `name.ilike.${pattern}`;
  const { data, count, error } = await supabase
    .from('products')
    .select(SUMMARY_COLUMNS, { count: 'exact' })
    .or(filter)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw toAppError(error);
  return { items: (data as SummaryRow[]).map(toSummary), total: count ?? 0 };
}

// 인기 순위: 최근 days일 결제 수량 순, 판매가 없으면 최신순으로 채움 (RPC get_best_products)
export async function getBestProducts({
  days = 7,
  limit = 8,
  artistSlug,
}: { days?: number; limit?: number; artistSlug?: string } = {}): Promise<BestProduct[]> {
  'use cache';
  cacheLife('minutes');
  const { data: ranks, error } = await supabase.rpc('get_best_products', {
    days,
    limit_count: limit,
    artist_slug: artistSlug,
  });
  if (error) throw toAppError(error);
  if (ranks.length === 0) return [];

  const { data, error: productError } = await supabase
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
  const { data: rows, error } = await supabase
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
