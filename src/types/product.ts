// 과제 규격의 상품 타입 (data/products.ts). 화면에서 쓰는 타입은 types/app.ts
export interface Product {
  id: number; // 상품 고유 식별자
  name: string; // 상품명
  price: number; // 가격 (원화 기준 숫자)
  category: string; // 카테고리 분류 ('앨범')
  imageUrl: string; // 대표 이미지 URL (Supabase Storage 공개 주소)
  description: string; // 상품 요약 설명
  isNew?: boolean; // 신상품 여부 (선택 속성)
}

// DB 대체용으로 화면(목록 필터·상세 옵션)에 필요한 값을 더한 형태
export interface StaticProduct extends Product {
  categorySlug: string; // 'album'
  artistSlug: string; // 'orbit-on'
  status: 'on_sale' | 'sold_out';
  createdAt: string; // 최신순 정렬 기준
  detailImageUrls: string[];
  variants: {
    id: number;
    optionName: string; // 옵션 없는 상품은 '기본' 1개
    extraPrice: number;
    stock: number;
    maxPerUser: number | null;
  }[];
}
