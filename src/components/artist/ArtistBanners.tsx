import { Skeleton } from "@/components/ui";
import { getArtistBanners, getArtistMembers } from "@/services/artists";
import { getProducts } from "@/services/products";
import type { Artist, ArtistPromoBanner, ProductSummary } from "@/types/app";
import { ArtistBannerCarousel, type ArtistBanner } from "./ArtistBannerCarousel";
import { artistThemeStyle } from "./artistTheme";
import { formatPrice } from "@/components/product/formatPrice";

const FEATURED_LIMIT = 3;

// DB(artist_banners)에 등록된 배너가 있으면 그대로 사용.
// 없으면 배너 1: 아티스트 단체 사진(클릭 시 멤버 소개 페이지), 배너 2~: 최신 상품으로 구성
export async function ArtistBanners({ artist }: { artist: Artist }) {
  let promos: ArtistPromoBanner[] = [];
  try {
    promos = await getArtistBanners(artist.slug);
  } catch {
    // 배너를 못 불러오면 기본 구성으로 보여줍니다.
  }
  if (promos.length > 0) {
    const banners = promos.map<ArtistBanner>((promo) => ({
      key: `promo-${promo.id}`,
      href: promo.href,
      title: promo.title,
      subtitle: promo.subtitle ?? "",
      imageUrl: promo.imageUrl,
      imageAlt: promo.title,
      variant: "cover",
    }));
    return <ArtistBannerCarousel banners={banners} themeStyle={artistThemeStyle(artist.themeColor)} />;
  }

  const [featured, hasMembers] = await Promise.all([
    getProducts({ artistSlug: artist.slug, limit: FEATURED_LIMIT })
      .then((result) => result.items)
      .catch((): ProductSummary[] => []), // 상품을 못 불러와도 배너는 보여주고, 상품 목록 영역에서 에러를 안내합니다.
    getArtistMembers(artist.slug)
      .then((members) => members.length > 0)
      .catch(() => true), // 확인을 못 하면 기존처럼 멤버 소개로 연결
  ]);

  const banners: ArtistBanner[] = [
    {
      key: "artist",
      // 멤버 정보가 없는 아티스트는 멤버 소개 페이지로 보내지 않음
      href: hasMembers ? `/artists/${artist.slug}/about` : null,
      title: artist.name,
      subtitle: hasMembers ? `${artist.nameKo} 멤버 소개 보기 ›` : (artist.tagline ?? artist.nameKo),
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
