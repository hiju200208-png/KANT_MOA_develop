import type { Address, AddressInput } from '@/types/app';
import { apiFetch, isLoggedIn, jsonBody } from './api';
import { AppError } from './errors';

// 배송지: FastAPI /addresses (P3). 첫 주소 자동 기본 지정, 기본 배송지 삭제 시 재지정은 서버가 처리한다

// FastAPI 배송지 응답 (snake_case)
type AddressResponse = {
  id: number;
  label: string | null;
  recipient_name: string;
  recipient_phone: string;
  postal_code: string;
  address1: string;
  address2: string | null;
  is_default: boolean;
};

const toAddress = (a: AddressResponse): Address => ({
  id: a.id,
  label: a.label,
  recipientName: a.recipient_name,
  recipientPhone: a.recipient_phone,
  postalCode: a.postal_code,
  address1: a.address1,
  address2: a.address2,
  isDefault: a.is_default,
});

const toBody = (input: AddressInput) => ({
  label: input.label,
  recipient_name: input.recipientName,
  recipient_phone: input.recipientPhone,
  postal_code: input.postalCode,
  address1: input.address1,
  address2: input.address2,
  is_default: input.isDefault ?? false,
});

function requireAuth() {
  if (!isLoggedIn()) throw new AppError('NOT_AUTHENTICATED');
}

// 기본 배송지가 맨 앞, 나머지는 최신순 (서버 정렬). 사람당 최대 10개라 한 페이지로 충분
export async function getAddresses(): Promise<Address[]> {
  requireAuth();
  const page = await apiFetch<{ items: AddressResponse[] }>('/addresses?page=1&size=100');
  return page.items.map(toAddress);
}

export async function setDefaultAddress(id: number): Promise<void> {
  requireAuth();
  await apiFetch<void>(`/addresses/${id}/default`, { method: 'PATCH' });
}

export async function createAddress(input: AddressInput): Promise<Address> {
  requireAuth();
  return toAddress(await apiFetch<AddressResponse>('/addresses', { method: 'POST', ...jsonBody(toBody(input)) }));
}

// isDefault: true면 기본 배송지로 지정. false는 무시 (기본 배송지는 항상 1개 유지)
export async function updateAddress(id: number, input: AddressInput): Promise<Address> {
  requireAuth();
  return toAddress(await apiFetch<AddressResponse>(`/addresses/${id}`, { method: 'PUT', ...jsonBody(toBody(input)) }));
}

export async function deleteAddress(id: number): Promise<void> {
  requireAuth();
  await apiFetch<void>(`/addresses/${id}`, { method: 'DELETE' });
}
