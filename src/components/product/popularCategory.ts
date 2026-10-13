// "인기 굿즈"는 DB 카테고리가 아니라 판매량 순위(getBestProducts)로 만든 가상 카테고리
export const POPULAR_CATEGORY = { slug: "best", name: "인기 굿즈" } as const;
export const POPULAR_LIMIT = 20;

// "전체"는 카테고리 탭 맨 앞에서 전체 상품 목록(/products)으로 이동하는 가상 탭
export const ALL_CATEGORY = { slug: "all", name: "전체", href: "/products" } as const;
