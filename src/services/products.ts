import type { Category, ProductDetail, ProductList, ProductQuery, SearchQuery } from '@/types/app';
import { catalogFetch, CatalogHttpError, publicApiOrigin } from './catalogClient';
import { productDetail, productRange, type ApiPage, type ApiProduct, type ApiProductDetail } from './catalogMapping';

// no-store 조회: 관리자 변경은 새 요청/새로고침에 반영한다. 실패를 예비 상품으로 바꾸지 않는다.
export async function getCategories(): Promise<Category[]> {
  return catalogFetch<Category[]>('/categories');
}

async function list(query: URLSearchParams, offset = 0, limit = 20): Promise<ProductList> {
  return productRange(async (page, size) => {
    const params = new URLSearchParams(query);
    params.set('page', String(page));
    params.set('size', String(size));
    return catalogFetch<ApiPage<ApiProduct>>(`/products?${params}`);
  }, publicApiOrigin(), offset, limit);
}

export async function getProducts({ artistSlug, categorySlug, sort = 'latest', limit = 20, offset = 0, excludeId }: ProductQuery = {}): Promise<ProductList> {
  const query = new URLSearchParams({ sort });
  if (artistSlug) query.set('artist', artistSlug);
  if (categorySlug) query.set('category', categorySlug);
  if (excludeId !== undefined) query.set('exclude_id', String(excludeId));
  return list(query, offset, limit);
}

export async function getProduct(id: number): Promise<ProductDetail | null> {
  try {
    return productDetail(await catalogFetch<ApiProductDetail>(`/products/${id}`), publicApiOrigin());
  } catch (error) {
    if (error instanceof CatalogHttpError && error.status === 404) return null;
    throw error;
  }
}

export async function searchProducts({ q, limit = 20, offset = 0 }: SearchQuery): Promise<ProductList> {
  const keyword = q.trim();
  if (!keyword) return { items: [], total: 0 };
  return list(new URLSearchParams({ q: keyword }), offset, limit);
}

// 인기순·배너는 8단계 범위다. 기존 모듈은 호출 시에만 로드해 상품 API와 분리한다.
export async function getBestProducts(query: { days?: number; limit?: number; artistSlug?: string } = {}) {
  return (await import('./legacyCatalog')).getBestProducts(query);
}
export async function getHomeBanners() {
  return (await import('./legacyCatalog')).getHomeBanners();
}
