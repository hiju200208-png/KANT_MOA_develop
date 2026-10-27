import { getPublicClient } from '@/lib/supabase/client';

export function getImageUrl(bucket: 'products' | 'artists', path: string | null) {
  if (!path) return null;
  return getPublicClient().storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
