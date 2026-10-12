import type { ProductSummary } from "@/types/app";
import { formatPrice } from "./formatPrice";

// 메인·아티스트 페이지 상단 배너 한 장
export type HeroSlide = {
  key: string;
  href: string;
  eyebrow: string; // 제목 위 작은 글씨 (아티스트 이름 등)
  title: string;
  subtitle: string;
  imageUrl: string | null;
  imageAlt: string;
  /** 배너 좌우 그라데이션 색 (artists.theme_color). 없으면 브랜드 색 */
  color: string | null;
  /** product: 정사각형 상품 이미지를 가운데에 띄움, cover: 사진으로 카드를 꽉 채움 */
  variant: "product" | "cover";
};

export function productToSlide(product: ProductSummary, color: string | null): HeroSlide {
  return {
    key: `product-${product.id}`,
    href: `/products/${product.id}`,
    eyebrow: product.artist.name,
    title: product.name,
    subtitle: `${product.category.name} · ${formatPrice(product.price)}`,
    imageUrl: product.thumbnailUrl,
    imageAlt: `${product.artist.name} ${product.name}`,
    color,
    variant: "product",
  };
}
