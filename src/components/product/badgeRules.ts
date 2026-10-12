import type { ProductSummary } from "@/types/app";

export type ProductBadge = "BEST" | "한정" | "예약" | "NEW";

const NEW_DAYS = 14; // 등록 후 이 기간까지 NEW
const BEST_RANK = 3; // 이 순위까지 BEST
const DAY_MS = 24 * 60 * 60 * 1000;

export type BadgeSource = Pick<ProductSummary, "isLimited" | "isPreorder" | "createdAt">;

// 상품 배지: 인기 순위·한정·예약 판매·신상품 순. now가 없으면 NEW는 계산하지 않음 (서버 렌더 시점 차이 방지)
export function productBadges(product: BadgeSource, rank?: number, now?: number): ProductBadge[] {
  const badges: ProductBadge[] = [];
  if (rank !== undefined && rank <= BEST_RANK) badges.push("BEST");
  if (product.isLimited) badges.push("한정");
  if (product.isPreorder) badges.push("예약");
  if (now !== undefined && now - Date.parse(product.createdAt) <= NEW_DAYS * DAY_MS) badges.push("NEW");
  return badges;
}
