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

// 화면은 code로 문구를 고른다. status는 services가 없음(404)·남의 것(403)·로그인 만료(401)를 구분할 때만 쓴다.
// detail은 API_SPEC 계약상 '문제된 variantId' 자리라 서버 문구를 넣지 않는다 (서버는 {code, message}만 준다).
export class ApiError extends AppError {
  constructor(
    public status: number, // 0 = 서버에 연결하지 못함
    code: AppErrorCode,
  ) {
    super(code);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers, cache: 'no-store' });
  } catch {
    throw new ApiError(0, 'UNKNOWN');
  }
  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const code = (APP_ERROR_CODES as readonly string[]).includes(data?.code) ? (data.code as AppErrorCode) : 'UNKNOWN';
    throw new ApiError(response.status, code);
  }
  return data as T;
}

export const jsonBody = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });
