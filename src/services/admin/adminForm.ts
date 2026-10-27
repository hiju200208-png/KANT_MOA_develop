// 관리자 화면의 순수 계산·입력 검사 (React·fetch 없음 → tests/adminForm.test.ts에서 바로 테스트)
// 서버(FastAPI)도 같은 규칙을 다시 검사한다. 여기서는 잘못된 요청을 미리 막아 안내만 한다.

export const STATUS_LABELS = { on_sale: "판매중", sold_out: "품절", hidden: "숨김" } as const;
export const STATUS_OPTIONS = ["on_sale", "sold_out", "hidden"] as const;
export const LOW_STOCK = 5;
export const STOCK_CHANGE_LIMIT = 10000;

type QueryValue = string | number | null | undefined;

// 빈 값은 빼고 쿼리스트링을 만든다. 기본값(정렬 latest, page 1, size 20)도 생략
export function toQueryString(params: Record<string, QueryValue>, defaults: Record<string, QueryValue> = {}): string {
  const search = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    if (raw === null || raw === undefined) continue;
    const value = typeof raw === "string" ? raw.trim() : String(raw);
    if (value === "" || defaults[key] === raw) continue;
    search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export const PRODUCT_QUERY_DEFAULTS = { sort: "latest", page: 1, size: 20 };

// 재고 조정 입력: "+10", "-3", "5" → 정수. 0·범위 초과·소수는 오류 문구
export function parseStockChange(input: string): { value: number } | { error: string } {
  const text = input.trim();
  if (!/^[+-]?\d+$/.test(text)) return { error: "늘릴 수량(+) 또는 줄일 수량(-)을 정수로 입력해주세요." };
  const value = Number(text);
  if (value === 0) return { error: "0은 입력할 수 없어요." };
  if (Math.abs(value) > STOCK_CHANGE_LIMIT) return { error: `한 번에 ${STOCK_CHANGE_LIMIT.toLocaleString()}개까지 바꿀 수 있어요.` };
  return { value };
}

// 조정 후 재고 미리보기 (0 미만이면 서버가 409로 거절)
export function previewStock(current: number, change: number): { after: number; ok: boolean } {
  const after = current + change;
  return { after, ok: after >= 0 };
}

export function stockLevel(totalStock: number, isSoldOut: boolean): "out" | "low" | "ok" {
  if (isSoldOut || totalStock <= 0) return "out";
  if (totalStock <= LOW_STOCK) return "low";
  return "ok";
}

export type NoticeFormValues = {
  title: string;
  body: string;
  artistSlug: string;
  productId: string;
  isPinned: boolean;
  showInTopbar: boolean;
};

export const emptyNoticeForm = (): NoticeFormValues => ({
  title: "", body: "", artistSlug: "", productId: "", isPinned: false, showInTopbar: false,
});

export function validateNoticeForm(values: NoticeFormValues): Partial<Record<keyof NoticeFormValues, string>> {
  const errors: Partial<Record<keyof NoticeFormValues, string>> = {};
  const title = values.title.trim();
  if (!title) errors.title = "제목을 입력해주세요.";
  else if (title.length > 100) errors.title = "제목은 100자 이하로 입력해주세요.";
  if (values.body.length > 5000) errors.body = "본문은 5000자 이하로 입력해주세요.";
  if (values.artistSlug.trim() && !/^[a-z0-9][a-z0-9-]{0,63}$/.test(values.artistSlug.trim()))
    errors.artistSlug = "아티스트 slug는 영문 소문자·숫자·하이픈만 쓸 수 있어요.";
  if (values.productId.trim() && !/^[1-9]\d*$/.test(values.productId.trim()))
    errors.productId = "상품 번호는 1 이상의 숫자로 입력해주세요.";
  return errors;
}

// 폼 값 → API 요청 본문 (빈 칸은 null = 연결 없음)
export function toNoticeInput(values: NoticeFormValues) {
  return {
    title: values.title.trim(),
    body: values.body.trim() ? values.body : null,
    artist_slug: values.artistSlug.trim() || null,
    product_id: values.productId.trim() ? Number(values.productId.trim()) : null,
    is_pinned: values.isPinned,
    show_in_topbar: values.showInTopbar,
  };
}

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// 업로드 전 형식·크기 확인 (서버가 파일 내용까지 다시 검사한다)
export function checkImageFile(file: { type: string; size: number }): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return "JPG·PNG·WebP 이미지만 올릴 수 있어요.";
  if (file.size <= 0) return "빈 파일이에요.";
  if (file.size > MAX_IMAGE_BYTES) return "5MB 이하 이미지만 올릴 수 있어요.";
  return null;
}

// 목록 주소의 쿼리(?status=hidden&stock=low)를 필터 초기값으로 바꾼다. 잘못된 값은 무시
export function filtersFromQuery(get: (key: string) => string | null): {
  q: string;
  artist: string;
  status: "" | (typeof STATUS_OPTIONS)[number];
  stock: "" | "out" | "low";
  sort: "latest" | "stock_asc" | "name";
} {
  const status = get("status");
  const stock = get("stock");
  const sort = get("sort");
  return {
    q: (get("q") ?? "").slice(0, 100),
    artist: get("artist") ?? "",
    status: (STATUS_OPTIONS as readonly string[]).includes(status ?? "") ? (status as (typeof STATUS_OPTIONS)[number]) : "",
    stock: stock === "out" || stock === "low" ? stock : "",
    sort: sort === "stock_asc" || sort === "name" ? sort : "latest",
  };
}

// 체크박스 선택 토글 (새 Set을 돌려줘서 React 상태로 바로 쓴다)
export function toggleSelected(selected: ReadonlySet<number>, id: number): Set<number> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function validateLogin(email: string, password: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "이메일을 확인해주세요.";
  if (!password) return "비밀번호를 입력해주세요.";
  return null;
}
