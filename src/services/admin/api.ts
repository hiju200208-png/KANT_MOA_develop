// 관리자 API 함수 (docs/admin/P4_ADMIN.md 3장)
import type {
  AdminNotice,
  AdminProductDetail,
  AdminProductListItem,
  NoticeInput,
  Page,
  ProductFilters,
  ProductStatus,
  StockAdjustmentResult,
} from "@/types/admin";
import { PRODUCT_QUERY_DEFAULTS, toQueryString } from "./adminForm";
import { adminFetch } from "./client";

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
