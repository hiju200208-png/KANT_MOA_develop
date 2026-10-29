import type { Profile, UpdateProfileInput } from '@/types/app';

export type ProfileUser = { id: string; email: string; nickname: string; role: string; phone?: string | null };

export function toProfile(user: ProfileUser): Profile {
  return { id: user.id, email: user.email, nickname: user.nickname, phone: user.phone ?? null };
}

export function profileValidationError(input: UpdateProfileInput): string | null {
  if (input.nickname !== undefined && (!input.nickname.trim() || input.nickname.trim().length > 50)) {
    return '닉네임은 1~50자로 입력해주세요.';
  }
  const phone = input.phone?.trim();
  if (phone && (phone.length > 20 || !/^[0-9 -]+$/.test(phone) || !/^01[0-9]{8,9}$/.test(phone.replace(/[ -]/g, '')))) {
    return '휴대폰 번호를 정확히 입력해주세요.';
  }
  return null;
}
