// P1 로그인과 P3·P4 API가 공유하는 브라우저 토큰 계약. 토큰을 서버 렌더 캐시에 넣지 않는다.
export const ACCESS_TOKEN_STORAGE_KEY = 'kantmoa.accessToken';
export const AUTH_CHANGE_EVENT = 'kantmoa-auth-change';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY); } catch { return null; }
}

export function setAccessToken(token: string): void {
  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function clearAccessToken(expected?: string): void {
  if (typeof window === 'undefined' || (expected && getAccessToken() !== expected)) return;
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}
