import { publicClient as supabase } from '@/lib/supabase/client';
import type { ShopSettings } from '@/types/app';
import { toAppError } from './errors';

// 쇼핑몰 설정 (배송비·사업자 정보). 한 줄짜리 테이블
export async function getShopSettings(): Promise<ShopSettings> {
  const { data, error } = await supabase.from('shop_settings').select('*').single();
  if (error) throw toAppError(error);
  return {
    freeShippingThreshold: data.free_shipping_threshold,
    shippingFee: data.shipping_fee,
    shipDaysText: data.ship_days_text,
    companyName: data.company_name,
    ceoName: data.ceo_name,
    businessNumber: data.business_number,
    ecommerceNumber: data.ecommerce_number,
    address: data.address,
    csPhone: data.cs_phone,
    csHours: data.cs_hours,
  };
}

// 배송비 계산은 테스트할 수 있게 lib/shipping.ts에 둠 (Supabase import 없음)
export { calcShippingFee } from '@/lib/shipping';
