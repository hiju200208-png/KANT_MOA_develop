// Compatibility entry point. All requests use FastAPI.
import type { BestProduct, HomeBanner } from '@/types/app';
import { catalogFetch, publicApiOrigin } from './catalogClient';
import { assetUrl, productSummary, type ApiProduct } from './catalogMapping';

export async function getBestProducts({ days=7, limit=8, artistSlug }: { days?: number; limit?: number; artistSlug?: string } = {}): Promise<BestProduct[]> {
  const query = new URLSearchParams({ days:String(days), limit:String(limit) });
  if (artistSlug) query.set('artist',artistSlug);
  const rows = await catalogFetch<(ApiProduct & { rank: number })[]>(`/products/best?${query}`);
  return rows.map((row) => ({ ...productSummary(row,publicApiOrigin()), rank:row.rank }));
}
export async function getHomeBanners(): Promise<{ main: HomeBanner[]; side: HomeBanner[] }> {
  const rows = await catalogFetch<{ id:number; slot:string; eyebrow:string|null; title:string; subtitle:string|null; badge:string|null; image_path:string; link_path:string }[]>('/home-banners');
  const banners = rows.map((row) => ({ id:row.id, eyebrow:row.eyebrow, title:row.title, subtitle:row.subtitle, badge:row.badge, imageUrl:assetUrl(row.image_path,publicApiOrigin())!, href:row.link_path, slot:row.slot }));
  return { main:banners.filter((b) => b.slot==='main'), side:banners.filter((b) => b.slot==='side') };
}
