import { publicClient as supabase } from '@/lib/supabase/client';
import type { Database } from '@/types/database';
import type {
  Artist,
  ArtistMember,
  ArtistPromoBanner,
  BestProduct,
  Category,
  HomeBanner,
  ProductDetail,
  ProductList,
  ProductQuery,
  ProductStatus,
  ProductSummary,
  SearchQuery,
} from '@/types/app';
import { toAppError } from './errors';
import {
  fallbackArtist,
  fallbackArtists,
  fallbackCategories,
  fallbackProduct,
  fallbackProducts,
  warnFallback,
} from './fallback';
import { getImageUrl } from './storage';

type ArtistRow = Database['public']['Tables']['artists']['Row'];

const DAYLOG_MEMBER_BIRTHDAYS: Record<string, string> = {
  지아: '2006-02-08',
  희수: '2008-08-18',
  혜주: '2007-01-18',
  서연: '2009-05-22',
};

const DAYLOG_MEMBER_MASCOTS: Record<string, string> = {
  지아: "하늘빛 여우 '지야'",
  희수: "하트 강아지 '희봉'",
  혜주: "별빛 고양이 '주야'",
  서연: "리본 토끼 '연이'",
};

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
    mascot: slug === 'daylog' ? (DAYLOG_MEMBER_MASCOTS[m.name] ?? m.mascot) : m.mascot,
    birthday: slug === 'daylog' ? (DAYLOG_MEMBER_BIRTHDAYS[m.name] ?? m.birthday) : m.birthday,
    mbti: m.mbti,
    description: m.description,
    tags: m.tags,
    imageUrl: getImageUrl('artists', m.image_path),
  }));
}

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug')
    .order('sort_order');
  if (error) {
    warnFallback('getCategories', error);
    return fallbackCategories();
  }
  return data;
}

const BASE_COLUMNS =
  'id, name, price, status, thumbnail_path, created_at, is_limited, is_preorder, release_date, artists!inner(slug, name, name_ko), categories!inner(slug, name)';
// 찜 목록(wishlist.ts)도 같은 형태로 변환하려고 내보냄
export const SUMMARY_COLUMNS = `${BASE_COLUMNS}, product_variants(stock)`;

export type SummaryRow = {
  id: number;
  name: string;
  price: number;
  status: string;
  thumbnail_path: string | null;
  created_at: string;
  is_limited: boolean;
  is_preorder: boolean;
  release_date: string | null;
  artists: { slug: string; name: string; name_ko: string };
  categories: { slug: string; name: string };
  product_variants: { stock: number }[];
};

export const toSummary = (p: SummaryRow): ProductSummary => ({
  id: p.id,
  name: p.name,
  price: p.price,
  status: p.status as ProductStatus, // hidden은 RLS가 걸러냄
  isSoldOut: p.status === 'sold_out' || p.product_variants.every((v) => v.stock === 0),
  thumbnailUrl: getImageUrl('products', p.thumbnail_path),
  artist: { slug: p.artists.slug, name: p.artists.name, nameKo: p.artists.name_ko },
  category: { slug: p.categories.slug, name: p.categories.name },
  isLimited: p.is_limited,
  isPreorder: p.is_preorder,
  releaseDate: p.release_date,
  createdAt: p.created_at,
});

export async function getProducts({
  artistSlug,
  categorySlug,
  sort = 'latest',
  limit = 20,
  offset = 0,
  excludeId,
}: ProductQuery = {}): Promise<ProductList> {
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
    warnFallback('getProducts', error);
    return fallbackProducts({ artistSlug, categorySlug, sort, limit, offset, excludeId });
  }
  return { items: (data as SummaryRow[]).map(toSummary), total: count ?? 0 };
}

export async function getProduct(id: number): Promise<ProductDetail | null> {
  const { data, error } = await supabase
    .from('products')
    .select(
      `${BASE_COLUMNS}, description, product_images(image_path, sort_order, kind), product_variants(id, option_name, extra_price, stock, max_per_user, sort_order)`,
    )
    .eq('id', id)
    .maybeSingle();
  if (error) {
    warnFallback('getProduct', error);
    return fallbackProduct(id);
  }
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
