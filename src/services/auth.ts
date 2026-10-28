import type { Profile, SignInInput, SignUpInput, UpdateProfileInput } from '@/types/app';
import { mergeGuestCart } from './cart';
import { apiFetch, jsonBody, ApiError } from './api';
import { AppError } from './errors';
import { ACCESS_TOKEN_STORAGE_KEY, AUTH_CHANGE_EVENT, clearAccessToken, getAccessToken, setAccessToken } from './session';

type CurrentUser = { id: string; email: string; nickname: string; role: string };

export type GoogleLoginConfig = { client_id: string | null; nonce: string | null };

export async function getGoogleLoginConfig(signal?: AbortSignal): Promise<GoogleLoginConfig> {
  return apiFetch<GoogleLoginConfig>('/auth/google/config', { credentials: 'include', signal });
}

export async function signInWithGoogle(credential: string, nonce: string): Promise<void> {
  let body: { access_token: string };
  try {
    body = await apiFetch<{ access_token: string }>('/auth/google', {
      method: 'POST', credentials: 'include', ...jsonBody({ credential, nonce }),
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      throw new Error('같은 이메일의 기존 계정이 있거나 Google 설정이 준비되지 않았어요. 기존 로그인 방법을 확인해주세요.');
    }
    throw error;
  }
  setAccessToken(body.access_token);
  await mergeGuestCart();
}

export async function signUp(input: SignUpInput): Promise<void> {
  await apiFetch<CurrentUser>('/auth/signup', { method: 'POST', ...jsonBody(input) });
  await signIn(input);
}

export async function signIn({ email, password }: SignInInput): Promise<void> {
  const body = await apiFetch<{ access_token: string }>('/auth/login', {
    method: 'POST', body: new URLSearchParams({ username: email, password }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  setAccessToken(body.access_token);
  await mergeGuestCart();
}

export async function signOut(): Promise<void> {
  const token = getAccessToken();
  if (token) {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== 'NOT_AUTHENTICATED') throw error;
    }
    clearAccessToken(token);
  }
}

export async function getProfile(): Promise<Profile | null> {
  if (!getAccessToken()) return null;
  try {
    const user = await apiFetch<CurrentUser>('/auth/me');
    return { id: user.id, email: user.email, nickname: user.nickname, phone: null };
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_AUTHENTICATED') return null;
    throw error;
  }
}

// P1에 아직 수정 API가 없다. FastAPI 회원 정보를 Supabase에 잘못 저장하지 않는다.
export async function updateProfile(_input: UpdateProfileInput): Promise<Profile> {
  void _input;
  throw new AppError('UNKNOWN', '회원 정보 수정 API는 아직 연결되지 않았어요.');
}

export function onAuthChange(cb: (profile: Profile | null) => void): () => void {
  let active = true;
  let version = 0;
  const load = async () => {
    const current = ++version;
    const token = getAccessToken();
    const profile = await getProfile().catch(() => null);
    if (active && current === version && token === getAccessToken()) cb(profile);
  };
  const storage = (event: StorageEvent) => {
    if (event.key === null || event.key === ACCESS_TOKEN_STORAGE_KEY) void load();
  };
  const visible = () => { if (document.visibilityState === 'visible') void load(); };
  window.addEventListener(AUTH_CHANGE_EVENT, load);
  window.addEventListener('storage', storage);
  window.addEventListener('focus', load);
  document.addEventListener('visibilitychange', visible);
  void load();
  return () => {
    active = false;
    ++version;
    window.removeEventListener(AUTH_CHANGE_EVENT, load);
    window.removeEventListener('storage', storage);
    window.removeEventListener('focus', load);
    document.removeEventListener('visibilitychange', visible);
  };
}
