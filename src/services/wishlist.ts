import { createClient } from '@/lib/supabase/client';
import type { ProductSummary } from '@/types/app';
import { AppError, toAppError } from './errors';
import { SUMMARY_COLUMNS, toSummary, type SummaryRow } from './products';

// 찜하기. 로그인 필요 (비로그인은 NOT_AUTHENTICATED). 판매 종료(hidden) 상품은 목록에서 빠짐

async function requireUser() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new AppError('NOT_AUTHENTICATED');
  return { supabase, userId };
}

// 최근 찜한 순
export async function getWishlist(): Promise<ProductSummary[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from('wishlists')
    .select(`created_at, products!inner(${SUMMARY_COLUMNS})`)
    .order('created_at', { ascending: false });
  if (error) throw toAppError(error);
  return (data as unknown as { products: SummaryRow }[]).map((w) => toSummary(w.products));
}

// 찜한 상품 id 목록. 상품 카드 여러 개의 하트 상태를 한 번에 그릴 때 사용 (비로그인은 빈 배열)
export async function getWishedIds(): Promise<number[]> {
  const supabase = createClient();
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return [];
  const { data, error } = await supabase.from('wishlists').select('product_id');
  if (error) throw toAppError(error);
  return data.map((w) => w.product_id);
}

// 비로그인은 false
export async function isWished(productId: number): Promise<boolean> {
  return (await getWishedIds()).includes(productId);
}

// 찜 ↔ 해제. 바뀐 뒤 상태를 돌려줌 (true = 찜함)
export async function toggleWishlist(productId: number): Promise<boolean> {
  const { supabase, userId } = await requireUser();
  const { data: removed, error } = await supabase
    .from('wishlists')
    .delete()
    .eq('product_id', productId)
    .select('product_id');
  if (error) throw toAppError(error);
  if (removed.length > 0) return false;

  const { error: insertError } = await supabase.from('wishlists').insert({ user_id: userId, product_id: productId });
  if (insertError && insertError.code !== '23505') throw toAppError(insertError); // 23505: 다른 탭에서 이미 찜함
  return true;
}
