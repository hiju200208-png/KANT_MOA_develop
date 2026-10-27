// 관리자 API 함수 (docs/admin/P4_ADMIN.md 3장)
import type {
  AdminDashboard,
  AdminNotice,
  AdminProductDetail,
  AdminProductListItem,
  NoticeInput,
  Page,
  ProductFilters,
  ProductStatus,
  StockAdjustmentResult,
  AuthUser,
} from "@/types/admin";
import { PRODUCT_QUERY_DEFAULTS, toQueryString } from "./adminForm";
import { adminFetch, setAdminAccessToken } from "./client";

// --- 로그인 (P1 /auth) ---
// 로그인은 OAuth2 form(username=이메일, password). 관리자(ADMIN)가 아니면 토큰을 지우고 403 안내
export async function adminLogin(email: string, password: string): Promise<AuthUser> {
  const body = new URLSearchParams({ username: email.trim(), password });
  const token = await adminFetch<{ access_token: string }>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  setAdminAccessToken(token.access_token);
  const me = await getMe();
  if (me.role !== "ADMIN") {
    setAdminAccessToken(null);
    throw new Error("관리자 계정이 아니에요. 관리자 계정으로 로그인해주세요.");
  }
  return me;
}

export function getMe() {
  return adminFetch<AuthUser>("/auth/me");
}

// 서버 블랙리스트에 토큰을 넣고(같은 토큰 재사용 시 401) 브라우저 토큰도 지운다
export async function adminLogout() {
  try {
    await adminFetch<void>("/auth/logout", { method: "POST" });
  } finally {
    setAdminAccessToken(null);
  }
}

export function getAdminDashboard() {
  return adminFetch<AdminDashboard>("/admin/dashboard");
}

export function bulkChangeStatus(productIds: number[], status: ProductStatus) {
  return adminFetch<{ status: ProductStatus; product_ids: number[]; updated: number }>("/admin/products/bulk-status", {
    method: "POST",
    body: JSON.stringify({ product_ids: productIds, status }),
  });
}

export function listAdminProducts(filters: ProductFilters) {
  return adminFetch<Page<AdminProductListItem>>(`/admin/products${toQueryString(filters, PRODUCT_QUERY_DEFAULTS)}`);
}

export function getAdminProduct(productId: number) {
  return adminFetch<AdminProductDetail>(`/admin/products/${productId}`);
}

export function changeProductStatus(productId: number, status: ProductStatus) {
  return adminFetch<AdminProductDetail>(`/admin/products/${productId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function adjustStock(productId: number, variantId: number, change: number, reason: string) {
  return adminFetch<StockAdjustmentResult>(`/admin/products/${productId}/variants/${variantId}/stock-adjustments`, {
    method: "POST",
    body: JSON.stringify({ change, reason: reason.trim() || null }),
  });
}

// 대표 이미지 교체: 파일을 요청 본문 그대로 보낸다 (JPG·PNG·WebP, 5MB 이하)
export function uploadProductThumbnail(productId: number, file: File) {
  return adminFetch<AdminProductDetail>(`/admin/products/${productId}/thumbnail`, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
}

export function listAdminNotices(page = 1, artist = "") {
  return adminFetch<Page<AdminNotice>>(`/admin/notices${toQueryString({ artist, page }, { page: 1 })}`);
}

export function createNotice(input: NoticeInput) {
  return adminFetch<AdminNotice>("/admin/notices", { method: "POST", body: JSON.stringify(input) });
}

export function updateNotice(noticeId: number, input: Partial<NoticeInput>) {
  return adminFetch<AdminNotice>(`/admin/notices/${noticeId}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteNotice(noticeId: number) {
  return adminFetch<void>(`/admin/notices/${noticeId}`, { method: "DELETE" });
}
