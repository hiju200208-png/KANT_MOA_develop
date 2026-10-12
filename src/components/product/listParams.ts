import type { ProductQuery } from "@/types/app";

export type ProductSort = NonNullable<ProductQuery["sort"]>;
export type SearchParams = Record<string, string | string[] | undefined>;

export const PAGE_SIZE = 20;
const MAX_LIMIT = 100;

export const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "latest", label: "최신순" },
  { value: "price_asc", label: "낮은 가격순" },
  { value: "price_desc", label: "높은 가격순" },
];

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function parseSort(params: SearchParams): ProductSort {
  const value = first(params.sort);
  return SORT_OPTIONS.some((option) => option.value === value) ? (value as ProductSort) : "latest";
}

export function parseLimit(params: SearchParams): number {
  const value = Number(first(params.limit));
  if (!Number.isInteger(value) || value < PAGE_SIZE) return PAGE_SIZE;
  return Math.min(value, MAX_LIMIT);
}

export function buildListHref(basePath: string, sort: ProductSort, limit = PAGE_SIZE) {
  const params = new URLSearchParams();
  if (sort !== "latest") params.set("sort", sort);
  if (limit > PAGE_SIZE) params.set("limit", String(limit));
  const query = params.toString();
  if (!query) return basePath;
  // basePath에 이미 쿼리가 있으면(예: ?category=album) 이어 붙임
  return `${basePath}${basePath.includes("?") ? "&" : "?"}${query}`;
}
