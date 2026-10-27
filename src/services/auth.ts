import { createClient } from '@/lib/supabase/client';
import type { Profile, SignInInput, SignUpInput, UpdateProfileInput } from '@/types/app';
import { ACCESS_TOKEN_KEY, ApiError, apiFetch, getAccessToken, setAccessToken } from './api';
import { mergeGuestCart } from './cart';
import { AppError, toAppError } from './errors';

// Supabase Auth 에러 코드 → 앱 에러 코드
function toAuthError(error: { code?: string; message: string }) {
  switch (error.code) {
    case 'invalid_credentials':
      return new AppError('INVALID_CREDENTIALS');
    case 'user_already_exists':
    case 'email_exists':
      return new AppError('EMAIL_ALREADY_EXISTS');
    case 'weak_password':
      return new AppError('WEAK_PASSWORD');
    default:
      return new AppError('UNKNOWN', error.message);
  }
}

export async function signUp({ email, password, nickname }: SignUpInput): Promise<void> {
  const { error } = await createClient().auth.signUp({
    email,
    password,
    options: { data: { nickname } }, // handle_new_user 트리거가 profiles.nickname으로 저장
  });
  if (error) throw toAuthError(error);
}

// 로그인·로그아웃·내 정보는 FastAPI(P1 /auth/login·/auth/logout·/auth/me). 토큰은 관리자 화면과 같은 localStorage 키에 둔다.
// 회원가입·내 정보 수정은 아직 Supabase (P1 프론트 전환 대상)
const AUTH_CHANGED = 'kantmoa:auth-changed';
const notifyAuthChanged = () => window.dispatchEvent(new Event(AUTH_CHANGED));

export async function signIn({ email, password }: SignInInput): Promise<void> {
  // OAuth2 password form: username 칸에 이메일. 틀리면 서버가 401 INVALID_CREDENTIALS
  const token = await apiFetch<{ access_token: string }>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: email, password }),
  });
  setAccessToken(token.access_token);
  await mergeGuestCart(); // 프로필을 알리기 전에 병합해야 장바구니 화면이 합친 결과를 불러온다
  notifyAuthChanged();
}

export async function signOut(): Promise<void> {
  // 서버 블랙리스트에 올린 뒤 브라우저 토큰을 지운다. 이미 만료된 토큰이어도 브라우저에서는 로그아웃한다
  if (getAccessToken()) await apiFetch<void>('/auth/logout', { method: 'POST' }).catch(() => {});
  setAccessToken(null);
  notifyAuthChanged();
}

export async function getProfile(): Promise<Profile | null> {
  if (!getAccessToken()) return null;
  try {
    const me = await apiFetch<{ id: string; email: string; nickname: string }>('/auth/me');
    return { id: me.id, email: me.email, nickname: me.nickname, phone: null }; // /auth/me에는 연락처가 없다
  } catch (error) {
    // 만료·로그아웃된 토큰이면 로그아웃 상태로 정리한다
    if (error instanceof ApiError && error.status === 401) {
      setAccessToken(null);
      return null;
    }
    throw error;
  }
}

export async function updateProfile(input: UpdateProfileInput): Promise<Profile> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AppError('NOT_AUTHENTICATED');

  const { data, error } = await supabase
    .from('profiles')
    .update(input)
    .eq('id', user.id)
    .select('id, nickname, phone')
    .single();
  if (error) throw toAppError(error);
  return { ...data, email: user.email ?? '' };
}

// 앱 최상단 클라이언트 Provider에서 한 번 구독. 처음 한 번 + 로그인·로그아웃 때마다 프로필을 알린다
// (비회원 장바구니 병합은 signIn이 알리기 전에 끝낸다)
export function onAuthChange(cb: (profile: Profile | null) => void): () => void {
  let active = true;
  const emit = () => {
    getProfile()
      .catch(() => null)
      .then((profile) => active && cb(profile));
  };
  // 다른 탭에서 로그인·로그아웃하면 localStorage 변경 이벤트로 따라간다
  const onStorage = (event: StorageEvent) => {
    if (event.key === ACCESS_TOKEN_KEY) emit();
  };
  window.addEventListener(AUTH_CHANGED, emit);
  window.addEventListener('storage', onStorage);
  emit();
  return () => {
    active = false;
    window.removeEventListener(AUTH_CHANGED, emit);
    window.removeEventListener('storage', onStorage);
  };
}
