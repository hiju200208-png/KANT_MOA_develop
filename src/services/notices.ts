import type { Notice } from '@/types/app';
import { catalogFetch, CatalogHttpError } from './catalogClient';
import { noticeFromApi, type ApiNotice } from './catalogMapping';

export function formatNoticeDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(iso)).replaceAll('-', '.');
}
export async function getNotices({ artistSlug, limit=20 }: { artistSlug?: string; limit?: number } = {}): Promise<Notice[]> {
  const query = new URLSearchParams({ limit:String(limit) });
  if (artistSlug) query.set('artist',artistSlug);
  return (await catalogFetch<ApiNotice[]>(`/notices?${query}`)).map((row) => noticeFromApi(row));
}
export async function getNotice(id: number, artistSlug?: string): Promise<Notice | null> {
  const query = new URLSearchParams(); if (artistSlug) query.set('artist',artistSlug);
  try { return noticeFromApi(await catalogFetch<ApiNotice>(`/notices/${id}?${query}`)); }
  catch (error) { if (error instanceof CatalogHttpError && error.status === 404) return null; throw error; }
}
export async function getTopbarNotice(): Promise<Notice | null> {
  const row = await catalogFetch<ApiNotice | null>('/notices/topbar');
  return row ? noticeFromApi(row) : null;
}
