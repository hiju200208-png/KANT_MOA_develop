// DB 조회가 실패했을 때 정적 데이터(src/data)로 같은 반환 형태를 만들어 준다.
// 카탈로그(아티스트·카테고리·상품) 읽기 전용. 장바구니·주문은 DB가 필요해 대체하지 않는다.
import { artists, categories } from '@/data/catalog';
import { products } from '@/data/products';
import type { Artist, Category, ProductDetail, ProductList, ProductQuery, ProductSummary } from '@/types/app';
import type { StaticProduct } from '@/types/product';

export function warnFallback(target: string, error: unknown) {
  console.warn(`[fallback] ${target} DB 조회 실패 → 정적 데이터 사용`, error);
}

const toSummary = (p: StaticProduct): ProductSummary => {
  const artist = artists.find((a) => a.slug === p.artistSlug)!;
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    status: p.status,
    isSoldOut: p.status === 'sold_out' || p.variants.every((v) => v.stock === 0),
    thumbnailUrl: p.imageUrl,
    artist: { slug: artist.slug, name: artist.name, nameKo: artist.nameKo },
    category: { slug: p.categorySlug, name: p.category },
  };
};

export const fallbackArtists = (): Artist[] => artists;

export const fallbackArtist = (slug: string): Artist | null => artists.find((a) => a.slug === slug) ?? null;

export const fallbackCategories = (): Category[] => categories;

export function fallbackProducts({
  artistSlug,
  categorySlug,
  sort = 'latest',
  limit = 20,
  offset = 0,
}: ProductQuery = {}): ProductList {
  const filtered = products.filter(
    (p) => (!artistSlug || p.artistSlug === artistSlug) && (!categorySlug || p.categorySlug === categorySlug),
  );
  // data/products.ts가 이미 최신순이라 latest는 그대로, 가격순은 같은 가격이면 id 오름차순 (DB 정렬과 동일)
  const sorted =
    sort === 'latest' ? filtered : [...filtered].sort((a, b) => (sort === 'price_asc' ? a.price - b.price : b.price - a.price) || a.id - b.id);
  return { items: sorted.slice(offset, offset + limit).map(toSummary), total: filtered.length };
}

export function fallbackProduct(id: number): ProductDetail | null {
  const p = products.find((item) => item.id === id);
  if (!p) return null;
  const variants = p.variants.map((v) => ({
    ...v,
    price: p.price + v.extraPrice,
    isSoldOut: v.stock === 0,
  }));
  return {
    ...toSummary(p),
    description: p.description,
    imageUrls: p.detailImageUrls,
    variants,
    hasOptions: !(variants.length === 1 && variants[0].optionName === '기본'),
  };
}
