import type { ShopSettings } from '@/types/app';
import { catalogFetch } from './catalogClient';
import { settingsFromApi, type ApiSettings } from './catalogMapping';

export async function getShopSettings(): Promise<ShopSettings> {
  return settingsFromApi(await catalogFetch<ApiSettings>('/shop-settings'));
}
export { calcShippingFee } from '@/lib/shipping';
