import { connection } from "next/server";
import { Suspense } from "react";
import { ArtistPicker } from "@/components/product/ArtistPicker";
import { ArtistShowcase, ArtistShowcaseSkeleton } from "@/components/product/ArtistShowcase";
import { LoadError } from "@/components/product/LoadError";
import { productToSlide } from "@/components/product/heroSlides";
import { MainHeroCarousel } from "@/components/product/MainHeroCarousel";
import { RecentlyViewedProducts } from "@/components/product/RecentlyViewedProducts";
import { EmptyState, Skeleton } from "@/components/ui";
import { getArtists, getProducts } from "@/services/products";
import type { Artist, ProductSummary } from "@/types/app";

// 아티스트마다 배너 후보로 가져올 최대 상품 수
const HERO_POOL_LIMIT = 50;

export default function HomePage() {
  return (
    <>
      <h1 className="sr-only">KANT MOA 공식 굿즈샵</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-none md:h-68" />}>
        <MainHero />
      </Suspense>

      {/* 간격 규칙(8px 단위): 섹션 사이는 넓게(48/56px), 섹션 안 요소는 가깝게 */}
      <div className="content-shell space-y-12 pt-10 pb-14 md:space-y-14 md:pt-12 md:pb-16">
        <Suspense fallback={<Skeleton className="h-60 w-full rounded-xl md:h-76" />}>
          <RecommendedArtists />
        </Suspense>

        <section aria-label="아티스트별 굿즈">
          <Suspense fallback={<ArtistShowcaseSkeleton />}>
            <ArtistShowcases />
          </Suspense>
        </section>

        <RecentlyViewedProducts />
      </div>
    </>
  );
}

// 아티스트마다 판매 중인 상품 하나를 무작위로 고릅니다 (모두 품절이면 품절 상품 중에서).
async function pickHeroProducts(artists: Artist[]): Promise<ProductSummary[]> {
  const picks = await Promise.all(
    artists.map(async (artist) => {
      try {
        const { items } = await getProducts({ artistSlug: artist.slug, limit: HERO_POOL_LIMIT });
        const onSale = items.filter((product) => !product.isSoldOut);
        const pool = onSale.length > 0 ? onSale : items;
        return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
      } catch {
        return null; // 한 아티스트를 못 불러와도 나머지 배너는 보여줌
      }
    }),
  );
  return picks.filter((product): product is ProductSummary => product !== null);
}

// 아티스트별 상품 중 하나를 무작위로 골라 배너에 한 장씩 보여줍니다 (새로고침할 때마다 바뀜).
async function MainHero() {
  await connection(); // 요청마다 다른 상품을 고르기 위해 미리 렌더링하지 않음
  let artists: Artist[];
  try {
    artists = await getArtists();
  } catch {
    return null; // 배너는 부가 영역이라 실패 시 숨기고, 아래 상품 영역에서 에러를 안내합니다.
  }

  const products = await pickHeroProducts(artists);
  if (products.length === 0) return null;

  // 배너 좌우 그라데이션은 아티스트 시그니처 컬러. 없으면 브랜드 색으로 대체
  const themeColors = new Map(artists.map((artist) => [artist.slug, artist.themeColor]));
  const slides = products.map((product) => productToSlide(product, themeColors.get(product.artist.slug) ?? null));
  return <MainHeroCarousel slides={slides} />;
}

async function RecommendedArtists() {
  let artists: Artist[];
  try {
    artists = await getArtists();
  } catch (error) {
    return <LoadError error={error} retryHref="/" />;
  }
  if (artists.length === 0) return null;
  return <ArtistPicker artists={artists} />;
}

async function ArtistShowcases() {
  let artists: Artist[];
  try {
    artists = await getArtists();
  } catch (error) {
    return <LoadError error={error} retryHref="/" />;
  }
  if (artists.length === 0) return <EmptyState title="등록된 아티스트가 없어요" />;
  return (
    <div className="space-y-6 md:space-y-8">
      {artists.map((artist) => (
        <Suspense key={artist.id} fallback={<ArtistShowcaseSkeleton />}>
          <ArtistShowcase artist={artist} />
        </Suspense>
      ))}
    </div>
  );
}
