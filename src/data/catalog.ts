// 정적 아티스트·카테고리 데이터. DB 조회 실패 시 대체용 (services/fallback.ts)
import type { Artist, Category } from '@/types/app';

export const artists: Artist[] = [
  {
    id: 1,
    name: 'ORBIT:ON',
    nameKo: '오르빗온',
    slug: 'orbit-on',
    logoUrl: 'https://rhnogvfrqoxgtcminuwa.supabase.co/storage/v1/object/public/artists/orbit-on/logo.webp',
    heroImageUrl: 'https://rhnogvfrqoxgtcminuwa.supabase.co/storage/v1/object/public/artists/orbit-on/hero.webp',
    themeColor: '#B8A4FF',
  },
  {
    id: 2,
    name: 'DAYLOG',
    nameKo: '데이로그',
    slug: 'daylog',
    logoUrl: 'https://rhnogvfrqoxgtcminuwa.supabase.co/storage/v1/object/public/artists/daylog/logo.webp',
    heroImageUrl: 'https://rhnogvfrqoxgtcminuwa.supabase.co/storage/v1/object/public/artists/daylog/hero.webp',
    themeColor: '#F4C2C2',
  },
  {
    id: 3,
    name: 'SODAFM',
    nameKo: '소다에프엠',
    slug: 'sodafm',
    logoUrl: 'https://rhnogvfrqoxgtcminuwa.supabase.co/storage/v1/object/public/artists/sodafm/logo.webp',
    heroImageUrl: 'https://rhnogvfrqoxgtcminuwa.supabase.co/storage/v1/object/public/artists/sodafm/hero.webp',
    themeColor: '#87CEEB',
  },
];

export const categories: Category[] = [
  { id: 1, name: '앨범', slug: 'album' },
  { id: 2, name: '응원용품', slug: 'cheering' },
  { id: 3, name: '인형', slug: 'doll' },
  { id: 4, name: '액세서리', slug: 'accessory' },
  { id: 5, name: '의류', slug: 'apparel' },
  { id: 6, name: '생활용품', slug: 'living' },
  { id: 7, name: '멤버십', slug: 'membership' },
];
