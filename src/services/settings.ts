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

// 장바구니·주문서 표시용 배송비. 실제 결제 금액은 create_order가 같은 규칙으로 DB에서 계산
export function calcShippingFee(itemsPrice: number, settings: Pick<ShopSettings, 'freeShippingThreshold' | 'shippingFee'>): number {
  if (itemsPrice <= 0) return 0;
  return itemsPrice >= settings.freeShippingThreshold ? 0 : settings.shippingFee;
}
