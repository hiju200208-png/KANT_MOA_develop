import { ADMIN_TOKEN_STORAGE_KEY, apiAssetUrl } from './admin/client';
import { APP_ERROR_CODES, AppError, type AppErrorCode } from './errors';

// 쇼핑 화면(장바구니·주문·배송지)의 FastAPI 호출 공통 부분. 오류는 {code, message} → AppError
// - 주소: NEXT_PUBLIC_API_URL (없으면 로컬 http://localhost:8000). 관리자 화면(admin/client.ts)과 같다.
// - 토큰: 관리자 화면과 같은 localStorage 키. 로그인(P1)이 이 키에 access token을 저장하면 그대로 동작한다.

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

export { apiAssetUrl };

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export const isLoggedIn = () => getAccessToken() !== null;

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers, cache: 'no-store' });
  } catch {
    throw new AppError('UNKNOWN', '서버에 연결할 수 없어요.');
  }
  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const code = (APP_ERROR_CODES as readonly string[]).includes(data?.code) ? (data.code as AppErrorCode) : 'UNKNOWN';
    // 서버 message는 화면 문구(ERROR_MESSAGES)가 없는 UNKNOWN일 때 참고용으로 detail에 남긴다
    throw new AppError(code, typeof data?.message === 'string' ? data.message : undefined);
  }
  return data as T;
}

export const jsonBody = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });
