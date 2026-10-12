// services 반환 타입. 명세: docs/API_SPEC.md 1장 (변경 시 문서 먼저 수정)

export type ProductStatus = 'on_sale' | 'sold_out'; // hidden은 조회되지 않음
export type OrderStatus = 'pending' | 'paid' | 'cancelled';

export type Artist = {
  id: number;
  name: string; // 'ORBIT:ON'
  nameKo: string; // '오르빗온'
  slug: string; // 'orbit-on'
  logoUrl: string | null;
  heroImageUrl: string | null; // 아티스트 페이지 상단 배경 (1920×720)
  themeColor: string | null;
  tagline: string | null; // 아티스트 섹션 한 줄 소개
};

// 아티스트 페이지 상단 배너 (DB에 등록된 경우만. 없으면 화면이 hero + 최신 상품으로 구성)
export type ArtistPromoBanner = {
  id: number;
  title: string;
  subtitle: string | null;
  imageUrl: string; // 16:9, 글씨 없는 배경 이미지
  href: string; // 사이트 내부 경로
};

export type ArtistMember = {
  id: number;
  name: string; // '선우' (상품 옵션명과 동일)
  nameEn: string; // 'SUNWOO'
  position: string | null;
  color: string | null; // 멤버 컬러 '#FF8A3D'
  mascot: string | null;
  birthday: string | null; // 'YYYY-MM-DD'
  mbti: string | null;
  description: string | null; // 한 줄 소개
  tags: string[];
  imageUrl: string | null; // 정사각형 1080×1080
};

export type Category = {
  id: number;
  name: string; // '앨범'
  slug: string; // 'album'
};

export type ProductSummary = {
  id: number;
  name: string;
  price: number; // 기본가 (옵션 추가금 제외)
  status: ProductStatus;
  isSoldOut: boolean; // status === 'sold_out' 이거나 모든 옵션 재고 0
  thumbnailUrl: string | null;
  artist: Pick<Artist, 'slug' | 'name' | 'nameKo'>;
  category: Pick<Category, 'slug' | 'name'>;
  isLimited: boolean; // '한정' 배지
  isPreorder: boolean; // '예약 판매' 배지
  releaseDate: string | null; // 'YYYY-MM-DD'
  createdAt: string; // ISO. NEW 배지는 프론트에서 계산
};

// 인기 순위 (getBestProducts). rank는 1부터
export type BestProduct = ProductSummary & { rank: number };

export type Variant = {
  id: number;
  optionName: string; // '리온', 'M', 'A버전', '기본'
  extraPrice: number;
  price: number; // 상품 기본가 + extraPrice
  stock: number;
  maxPerUser: number | null; // null = 무제한
  isSoldOut: boolean; // stock === 0
};

export type ProductDetail = ProductSummary & {
  description: string | null;
  imageUrls: string[]; // = detailUrls (기존 화면 호환용)
  galleryUrls: string[]; // 상단 썸네일 갤러리 (kind = gallery)
  detailUrls: string[]; // 아래 긴 상세 이미지 (kind = detail)
  variants: Variant[]; // 1개 이상. 옵션 없는 상품은 optionName '기본' 1개
  hasOptions: boolean; // variants가 '기본' 1개뿐이면 false → 옵션 선택 UI 숨김
};

export type ProductQuery = {
  artistSlug?: string;
  categorySlug?: string;
  sort?: 'latest' | 'price_asc' | 'price_desc'; // 기본 'latest'
  limit?: number; // 기본 20
  offset?: number; // 기본 0
  excludeId?: number; // 이 상품은 빼고 (상세의 '함께 보면 좋은 굿즈')
};

export type SearchQuery = {
  q: string; // 상품명·아티스트명(영문·한글) 부분 일치
  limit?: number; // 기본 20
  offset?: number; // 기본 0
};

export type ProductList = {
  items: ProductSummary[];
  total: number;
};

export type CartItem = {
  variantId: number;
  quantity: number;
  product: Pick<ProductSummary, 'id' | 'name' | 'thumbnailUrl'>;
  optionName: string;
  unitPrice: number; // 현재 가격 (기본가 + 추가금)
  stock: number;
  maxPerUser: number | null;
  isAvailable: boolean; // 판매 중이고 재고 >= quantity
};

export type Cart = {
  items: CartItem[];
  totalQuantity: number; // 헤더 뱃지용
  totalPrice: number; // 표시용 (isAvailable 항목만 합산)
};

export type OrderItem = {
  variantId: number;
  productName: string; // 주문 당시 스냅샷
  optionName: string; // 주문 당시 스냅샷
  unitPrice: number; // 주문 당시 스냅샷
  quantity: number;
};

export type OrderSummary = {
  id: string; // uuid
  status: OrderStatus;
  totalPrice: number;
  itemCount: number;
  firstItemName: string; // 목록 표시용: "아크릴 키링 외 2건"
  createdAt: string; // ISO
};

export type Order = OrderSummary & {
  itemsPrice: number; // 상품 금액 합계 (totalPrice - shippingFee)
  shippingFee: number;
  recipientName: string;
  recipientPhone: string;
  address: string;
  paidAt: string | null;
  cancelledAt: string | null;
  items: OrderItem[];
};

export type CreateOrderInput = {
  recipientName: string;
  recipientPhone: string;
  address: string;
};

export type Profile = {
  id: string;
  email: string;
  nickname: string;
  phone: string | null;
};

export type SignUpInput = { email: string; password: string; nickname: string };
export type SignInInput = { email: string; password: string };
export type UpdateProfileInput = { nickname?: string; phone?: string | null };

export type Address = {
  id: number;
  label: string | null; // '집', '회사'
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address1: string; // 기본주소
  address2: string | null; // 상세주소
  isDefault: boolean;
};

// 메인 기획전 배너. main = 큰 카드, side = 오른쪽 작은 카드
export type HomeBanner = {
  id: number;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  badge: string | null;
  imageUrl: string;
  href: string; // 사이트 내부 경로
};

export type Notice = {
  id: number;
  artistSlug: string | null; // null = 전체 공지
  title: string;
  body: string[]; // 줄 단위 ("## " 섹션, "- " 목록, "※ " 주의, "< >" 소제목)
  productId: number | null; // 상세 하단 '상품 보러가기'
  isPinned: boolean;
  showInTopbar: boolean;
  publishedAt: string; // ISO
  isNew: boolean; // 게시 7일 이내
};

export type ShopSettings = {
  freeShippingThreshold: number; // 상품 금액이 이 이상이면 무료배송
  shippingFee: number;
  shipDaysText: string;
  companyName: string;
  ceoName: string;
  businessNumber: string;
  ecommerceNumber: string;
  address: string;
  csPhone: string;
  csHours: string;
};

export type AddressInput = Omit<Address, 'id' | 'isDefault'> & { isDefault?: boolean };
