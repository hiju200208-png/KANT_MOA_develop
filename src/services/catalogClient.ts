import { AppError } from './errors';

export const publicApiOrigin = () => (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

export class CatalogHttpError extends AppError {
  readonly status: number;
  constructor(status: number, message?: string) {
    super('UNKNOWN', message);
    this.status = status;
  }
}

// 공개 카탈로그는 토큰·쿠키를 전송하지 않으며 사용자별 찜 응답과 캐시를 공유하지 않는다.
export async function catalogFetch<T>(path: string): Promise<T> {
  const origin = typeof window === 'undefined'
    ? (process.env.API_INTERNAL_URL ?? publicApiOrigin()).replace(/\/$/, '') : publicApiOrigin();
  let response: Response;
  try {
    response = await fetch(`${origin}${path}`, {
      cache: 'no-store', credentials: 'omit',
      headers: typeof window === 'undefined' ? { 'ngrok-skip-browser-warning': 'true' } : undefined,
    });
  } catch {
    throw new AppError('UNKNOWN', '서버에 연결할 수 없어요.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new CatalogHttpError(response.status, data?.message);
  if (data === null) throw new AppError('UNKNOWN', '상품 응답을 확인할 수 없어요.');
  return data as T;
}
