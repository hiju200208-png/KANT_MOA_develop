import type { ProductDetail, ProductList, ProductSummary } from '../types/app';

export type ApiProduct = {
  id: number; name: string; price: number; status: 'on_sale' | 'sold_out'; is_sold_out: boolean;
  thumbnail_path: string | null; created_at: string; is_limited: boolean; is_preorder: boolean;
  release_date: string | null;
  artist: { slug: string; name: string; name_ko: string };
  category: { slug: string; name: string };
};
export type ApiProductDetail = ApiProduct & {
  description: string | null; gallery_paths: string[]; detail_paths: string[]; has_options: boolean;
  variants: { id: number; option_name: string; extra_price: number; price: number; stock: number;
    max_per_user: number | null; is_sold_out: boolean }[];
};
export type ApiPage<T> = { items: T[]; total: number; page: number; size: number };

export function assetUrl(path: string | null, origin: string): string | null {
  if (!path) return null;
  return /^https?:\/\//.test(path) ? path : `${origin.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

export function isApiImage(path: string, origin: string): boolean {
  const base = origin.replace(/\/$/, '');
  return path.startsWith(`${base}/static/`) || path.startsWith(`${base}/uploads/`);
}

export function productSummary(row: ApiProduct, origin: string): ProductSummary {
  return {
    id: row.id, name: row.name, price: row.price, status: row.status, isSoldOut: row.is_sold_out,
    thumbnailUrl: assetUrl(row.thumbnail_path, origin), createdAt: row.created_at,
    isLimited: row.is_limited, isPreorder: row.is_preorder, releaseDate: row.release_date,
    artist: { slug: row.artist.slug, name: row.artist.name, nameKo: row.artist.name_ko }, category: row.category,
  };
}

export function productDetail(row: ApiProductDetail, origin: string): ProductDetail {
  const detailUrls = row.detail_paths.map((path) => assetUrl(path, origin)!);
  return {
    ...productSummary(row, origin), description: row.description, hasOptions: row.has_options,
    imageUrls: detailUrls, detailUrls, galleryUrls: row.gallery_paths.map((path) => assetUrl(path, origin)!),
    variants: row.variants.map((v) => ({ id: v.id, optionName: v.option_name, extraPrice: v.extra_price,
      price: v.price, stock: v.stock, maxPerUser: v.max_per_user, isSoldOut: v.is_sold_out })),
  };
}

// 기존 화면의 limit/offset(최대 500)을 API의 고정 size=100 페이지로 변환한다.
export async function productRange(
  load: (page: number, size: number) => Promise<ApiPage<ApiProduct>>,
  origin: string, offset = 0, limit = 20,
): Promise<ProductList> {
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
    throw new RangeError('상품 조회 범위를 확인해주세요.');
  }
  const size = 100;
  const firstPage = Math.floor(offset / size) + 1;
  const first = await load(firstPage, size);
  const rows = [...first.items];
  const end = Math.min(offset + limit, first.total);
  for (let page = firstPage + 1; (page - 1) * size < end; page++) {
    const next = await load(page, size);
    rows.push(...next.items);
    if (next.items.length < size) break;
  }
  const from = offset % size;
  return { items: rows.slice(from, from + limit).map((row) => productSummary(row, origin)), total: first.total };
}
