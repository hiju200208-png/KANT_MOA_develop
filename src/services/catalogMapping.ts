import type { Artist, ArtistMember, Notice, ShopSettings, ProductDetail, ProductList, ProductSummary } from '../types/app';

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


export type ApiArtist = { id:number; name:string; name_ko:string; slug:string; logo_path:string|null; hero_image_path:string|null; theme_color:string|null; tagline:string|null };
export function artistFromApi(a: ApiArtist, origin: string): Artist {
  return { id:a.id, name:a.name, nameKo:a.name_ko, slug:a.slug, logoUrl:assetUrl(a.logo_path,origin), heroImageUrl:assetUrl(a.hero_image_path,origin), themeColor:a.theme_color, tagline:a.tagline };
}
export type ApiMember = { id:number; name:string; name_en:string; position:string|null; color:string|null; mascot:string|null; birthday:string|null; mbti:string|null; description:string|null; tags:string[]; image_path:string|null };
export function memberFromApi(m: ApiMember, origin: string): ArtistMember {
  return { id:m.id, name:m.name, nameEn:m.name_en, position:m.position, color:m.color, mascot:m.mascot, birthday:m.birthday, mbti:m.mbti, description:m.description, tags:m.tags, imageUrl:assetUrl(m.image_path,origin) };
}
export type ApiNotice = { id:number; artist_slug:string|null; title:string; body:string|null; product_id:number|null; is_pinned:boolean; show_in_topbar:boolean; published_at:string };
export function noticeFromApi(n: ApiNotice, now=Date.now()): Notice {
  const age = now-Date.parse(n.published_at);
  return { id:n.id, artistSlug:n.artist_slug, title:n.title, body:n.body?.split('\n') ?? [], productId:n.product_id, isPinned:n.is_pinned, showInTopbar:n.show_in_topbar, publishedAt:n.published_at, isNew:age>=0 && age<7*24*60*60*1000 };
}
export type ApiSettings = { free_shipping_threshold:number; shipping_fee:number; ship_days_text:string; company_name:string; ceo_name:string; business_number:string; ecommerce_number:string; address:string; cs_phone:string; cs_hours:string };
export function settingsFromApi(s: ApiSettings): ShopSettings {
  return { freeShippingThreshold:s.free_shipping_threshold, shippingFee:s.shipping_fee, shipDaysText:s.ship_days_text, companyName:s.company_name, ceoName:s.ceo_name, businessNumber:s.business_number, ecommerceNumber:s.ecommerce_number, address:s.address, csPhone:s.cs_phone, csHours:s.cs_hours };
}
