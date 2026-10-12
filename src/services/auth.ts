import { createClient } from '@/lib/supabase/client';
import type { Profile, SignInInput, SignUpInput, UpdateProfileInput } from '@/types/app';
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

export async function signIn({ email, password }: SignInInput): Promise<void> {
  const { error } = await createClient().auth.signInWithPassword({ email, password });
  if (error) throw toAuthError(error);
}

export async function signOut(): Promise<void> {
  const { error } = await createClient().auth.signOut();
  if (error) throw toAuthError(error);
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, nickname, phone')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw toAppError(error);
  return data && { ...data, email: user.email ?? '' };
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

// 앱 최상단 클라이언트 Provider에서 한 번 구독. 로그인 시 비회원 장바구니를 자동 병합
export function onAuthChange(cb: (profile: Profile | null) => void): () => void {
  const {
    data: { subscription },
  } = createClient().auth.onAuthStateChange((event) => {
    if (event === 'TOKEN_REFRESHED') return;
    // 콜백 안에서 바로 Supabase를 호출하면 교착될 수 있어 다음 틱으로 미룸 (Supabase 권장)
    setTimeout(async () => {
      if (event === 'SIGNED_IN') await mergeGuestCart();
      cb(await getProfile().catch(() => null));
    }, 0);
  });
  return () => subscription.unsubscribe();
}
