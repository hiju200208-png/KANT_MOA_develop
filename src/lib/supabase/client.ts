import { createBrowserClient } from '@supabase/ssr';
import { createClient as createPlainClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// 로그인 세션이 필요한 호출 (auth, cart, orders). 브라우저 전용, 내부적으로 싱글톤
export function createClient() {
  return createBrowserClient<Database>(url, key);
}

// 세션 없이 읽는 공개 데이터 (카탈로그, Storage URL). 서버·클라이언트 모두 사용 가능
// ponytail: 서버 컴포넌트에서 로그인 사용자 데이터를 읽어야 하면 server.ts + src/proxy.ts 추가
let publicClient: SupabaseClient<Database> | undefined;
export function getPublicClient(): SupabaseClient<Database> {
  if (!url || !key) throw new Error('아직 전환하지 않은 카탈로그의 Supabase 설정이 없어요.');
  publicClient ??= createPlainClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return publicClient;
}
