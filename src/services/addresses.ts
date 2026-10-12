import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database';
import type { Address, AddressInput } from '@/types/app';
import { AppError, toAppError } from './errors';

// 첫 주소 자동 기본 지정, 기본 배송지 삭제 시 재지정은 DB 트리거가 처리 (migrations/..._add_addresses.sql)

type AddressRow = Database['public']['Tables']['addresses']['Row'];

const toAddress = (a: AddressRow): Address => ({
  id: a.id,
  label: a.label,
  recipientName: a.recipient_name,
  recipientPhone: a.recipient_phone,
  postalCode: a.postal_code,
  address1: a.address1,
  address2: a.address2,
  isDefault: a.is_default,
});

const toRow = (input: AddressInput) => ({
  label: input.label,
  recipient_name: input.recipientName,
  recipient_phone: input.recipientPhone,
  postal_code: input.postalCode,
  address1: input.address1,
  address2: input.address2,
});

async function requireUser() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new AppError('NOT_AUTHENTICATED');
  return { supabase, userId };
}

// 기본 배송지가 맨 앞, 나머지는 최신순
export async function getAddresses(): Promise<Address[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw toAppError(error);
  return data.map(toAddress);
}

export async function setDefaultAddress(id: number): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc('set_default_address', { p_address_id: id });
  if (error) throw toAppError(error);
}

async function getAddress(id: number): Promise<Address> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from('addresses').select('*').eq('id', id).single();
  if (error) throw toAppError(error);
  return toAddress(data);
}

export async function createAddress(input: AddressInput): Promise<Address> {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from('addresses')
    .insert({ ...toRow(input), user_id: userId })
    .select('*')
    .single();
  if (error) throw toAppError(error);
  if (input.isDefault && !data.is_default) {
    await setDefaultAddress(data.id);
    return getAddress(data.id);
  }
  return toAddress(data);
}

// isDefault: true면 기본 배송지로 지정. false는 무시 (기본 배송지는 항상 1개 유지)
export async function updateAddress(id: number, input: AddressInput): Promise<Address> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('addresses').update(toRow(input)).eq('id', id);
  if (error) throw toAppError(error);
  if (input.isDefault) await setDefaultAddress(id);
  return getAddress(id);
}

export async function deleteAddress(id: number): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('addresses').delete().eq('id', id);
  if (error) throw toAppError(error);
}
