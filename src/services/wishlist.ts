import type { ProductSummary } from '@/types/app';
import { apiFetch, getAccessToken } from './api';
import { publicApiOrigin } from './catalogClient';
import { productSummary, type ApiPage, type ApiProduct } from './catalogMapping';

export async function getWishlist(): Promise<ProductSummary[]> {
  const items: ProductSummary[] = [];
  for (let page = 1; ; page++) {
    const body = await apiFetch<ApiPage<ApiProduct>>(`/wishlist?page=${page}&size=100`);
    items.push(...body.items.map((row) => productSummary(row, publicApiOrigin())));
    if (items.length >= body.total || body.items.length === 0) return items;
  }
}

export async function getWishedIds(): Promise<number[]> {
  if (!getAccessToken()) return [];
  return apiFetch<number[]>('/wishlist/ids');
}

export async function isWished(productId: number): Promise<boolean> {
  return (await getWishedIds()).includes(productId);
}

export async function setWished(productId: number, wished: boolean): Promise<boolean> {
  const body = await apiFetch<{ product_id: number; is_wished: boolean }>(`/wishlist/${productId}`, {
    method: wished ? 'PUT' : 'DELETE',
  });
  return body.is_wished;
}
