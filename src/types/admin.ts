// 관리자 API(FastAPI /admin) 응답 타입. 기준: docs/admin/P4_ADMIN.md 3장

export type ProductStatus = "on_sale" | "sold_out" | "hidden";
export type ProductSort = "latest" | "stock_asc" | "name";
export type StockFilter = "out" | "low";

export type NamedRef = { slug: string; name: string };

export type Page<T> = { items: T[]; total: number; page: number; size: number };

export type AdminProductListItem = {
  id: number;
  name: string;
  artist: NamedRef;
  category: NamedRef | null;
  price: number;
  status: ProductStatus;
  thumbnail_url: string | null;
  total_stock: number;
  variant_count: number;
  is_sold_out: boolean;
};

export type AdminVariant = {
  id: number;
  option_name: string;
  extra_price: number;
  stock: number;
  max_per_user: number | null;
};

export type AdminProductDetail = Omit<AdminProductListItem, "total_stock" | "variant_count"> & {
  variants: AdminVariant[];
};

export type StockAdjustmentResult = { variant_id: number; before: number; after: number; change: number };

export type AdminNotice = {
  id: number;
  title: string;
  body: string | null;
  artist: NamedRef | null; // null = 전체 공지
  product_id: number | null;
  product_name: string | null;
  is_pinned: boolean;
  show_in_topbar: boolean;
  published_at: string;
};

export type NoticeInput = {
  title: string;
  body: string | null;
  artist_slug: string | null;
  product_id: number | null;
  is_pinned: boolean;
  show_in_topbar: boolean;
};

export type ProductFilters = {
  q: string;
  artist: string;
  category: string;
  status: ProductStatus | "";
  stock: StockFilter | "";
  sort: ProductSort;
  page: number;
  size: number;
};

export type AdminDashboard = {
  total: number;
  on_sale: number;
  sold_out: number; // 관리자가 직접 품절 처리
  hidden: number;
  out_of_stock: number; // 옵션 재고 합계 0 (목록 stock=out)
  low_stock: number; // 재고 5개 이하 옵션 있음 (목록 stock=low)
};

export type AuthUser = { id: string; email: string; nickname: string; role: "USER" | "ADMIN" };
