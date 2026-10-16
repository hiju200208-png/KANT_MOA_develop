import type { ProductStatus, ProductSummary } from '@/types/app';
import { getImageUrl } from './storage';

// 상품 목록 행 → ProductSummary 변환 (products.ts, wishlist.ts 공용).
// products.ts의 'use cache' 함수가 클라이언트(찜 버튼 → wishlist.ts)에 끌려가지 않도록 따로 둠
export const BASE_COLUMNS =
  'id, name, price, status, thumbnail_path, created_at, is_limited, is_preorder, release_date, artists!inner(slug, name, name_ko), categories!inner(slug, name)';
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
