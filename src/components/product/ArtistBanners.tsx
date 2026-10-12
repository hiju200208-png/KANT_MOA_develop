import { Skeleton } from "@/components/ui";
import { getProducts } from "@/services/products";
import type { Artist, ProductSummary } from "@/types/app";
import { ArtistBannerCarousel, type ArtistBanner } from "./ArtistBannerCarousel";
import { artistThemeStyle } from "./artistTheme";
import { formatPrice } from "./formatPrice";

const FEATURED_LIMIT = 3;

// 배너 1: 아티스트 단체 사진(클릭 시 멤버 소개 페이지), 배너 2~: 최신 상품 (별도 배너 테이블 없이 기존 데이터로 구성)
export async function ArtistBanners({ artist }: { artist: Artist }) {
  let featured: ProductSummary[] = [];
  try {
    featured = (await getProducts({ artistSlug: artist.slug, limit: FEATURED_LIMIT })).items;
  } catch {
    // 상품을 못 불러와도 아티스트 배너는 보여주고, 상품 목록 영역에서 에러를 안내합니다.
  }

  const banners: ArtistBanner[] = [
    {
      key: "artist",
      href: `/artists/${artist.slug}/about`,
      title: artist.name,
      subtitle: `${artist.nameKo} 멤버 소개 보기 ›`,
      imageUrl: artist.heroImageUrl,
      imageAlt: `${artist.name} 단체 사진`,
      variant: "cover",
    },
    ...featured.map<ArtistBanner>((product) => ({
      key: `product-${product.id}`,
      href: `/products/${product.id}`,
      title: product.name,
      subtitle: `${product.category.name} · ${formatPrice(product.price)}`,
      imageUrl: product.thumbnailUrl,
      imageAlt: `${artist.name} ${product.name}`,
      variant: "product",
    })),
  ];

  return <ArtistBannerCarousel banners={banners} themeStyle={artistThemeStyle(artist.themeColor)} />;
}

export function ArtistBannersSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2" aria-busy="true" aria-label="배너를 불러오는 중">
      <Skeleton className="aspect-video w-full rounded-lg" />
      <Skeleton className="hidden aspect-video w-full rounded-lg md:block" />
    </div>
  );
}
