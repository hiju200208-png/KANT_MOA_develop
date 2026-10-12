import { publicClient as supabase } from '@/lib/supabase/client';
import type { Database } from '@/types/database';
import type {
  Artist,
  ArtistMember,
  Category,
  ProductDetail,
  ProductList,
  ProductQuery,
  ProductStatus,
  ProductSummary,
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

const toArtist = (a: ArtistRow): Artist => ({
  id: a.id,
  name: a.name,
  nameKo: a.name_ko,
  slug: a.slug,
  logoUrl: getImageUrl('artists', a.logo_path),
  heroImageUrl: getImageUrl('artists', a.hero_image_path),
  themeColor: a.theme_color,
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
  'id, name, price, status, thumbnail_path, created_at, artists!inner(slug, name, name_ko), categories!inner(slug, name)';
const SUMMARY_COLUMNS = `${BASE_COLUMNS}, product_variants(stock)`;

type SummaryRow = {
  id: number;
  name: string;
  price: number;
  status: string;
  thumbnail_path: string | null;
  artists: { slug: string; name: string; name_ko: string };
  categories: { slug: string; name: string };
  product_variants: { stock: number }[];
};

const toSummary = (p: SummaryRow): ProductSummary => ({
  id: p.id,
  name: p.name,
  price: p.price,
  status: p.status as ProductStatus, // hidden은 RLS가 걸러냄
  isSoldOut: p.status === 'sold_out' || p.product_variants.every((v) => v.stock === 0),
  thumbnailUrl: getImageUrl('products', p.thumbnail_path),
  artist: { slug: p.artists.slug, name: p.artists.name, nameKo: p.artists.name_ko },
  category: { slug: p.categories.slug, name: p.categories.name },
});

export async function getProducts({
  artistSlug,
  categorySlug,
  sort = 'latest',
  limit = 20,
  offset = 0,
}: ProductQuery = {}): Promise<ProductList> {
  let query = supabase.from('products').select(SUMMARY_COLUMNS, { count: 'exact' });
  if (artistSlug) query = query.eq('artists.slug', artistSlug);
  if (categorySlug) query = query.eq('categories.slug', categorySlug);
  query =
    sort === 'latest'
      ? query.order('created_at', { ascending: false }).order('id', { ascending: false })
      : query.order('price', { ascending: sort === 'price_asc' }).order('id');

  const { data, count, error } = await query.range(offset, offset + limit - 1);
  if (error) {
    warnFallback('getProducts', error);
    return fallbackProducts({ artistSlug, categorySlug, sort, limit, offset });
  }
  return { items: (data as SummaryRow[]).map(toSummary), total: count ?? 0 };
}

export async function getProduct(id: number): Promise<ProductDetail | null> {
  const { data, error } = await supabase
    .from('products')
    .select(
      `${BASE_COLUMNS}, description, product_images(image_path, sort_order), product_variants(id, option_name, extra_price, stock, max_per_user, sort_order)`,
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
    product_images: { image_path: string; sort_order: number }[];
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

  return {
    ...toSummary(row),
    description: row.description,
    imageUrls: [...row.product_images]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => getImageUrl('products', i.image_path)!),
    variants,
    hasOptions: !(variants.length === 1 && variants[0].optionName === '기본'),
  };
}
