import { Suspense } from "react";
import { ArtistPicker } from "@/components/product/ArtistPicker";
import { ArtistShowcase, ArtistShowcaseSkeleton } from "@/components/product/ArtistShowcase";
import { LoadError } from "@/components/product/LoadError";
import { MainHeroCarousel } from "@/components/product/MainHeroCarousel";
import { RecentlyViewedProducts } from "@/components/product/RecentlyViewedProducts";
import { EmptyState, Skeleton } from "@/components/ui";
import { getArtists, getProducts } from "@/services/products";
import type { Artist, ProductSummary } from "@/types/app";

const HERO_LIMIT = 8;

export default function HomePage() {
  return (
    <>
      <h1 className="sr-only">KANT MOA 공식 굿즈샵</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-none md:h-80" />}>
        <MainHero />
      </Suspense>

      {/* 간격 규칙(8px 단위): 섹션 사이는 넓게(56/80px), 섹션 안 요소는 가깝게 */}
      <div className="content-shell space-y-14 pt-12 pb-16 md:space-y-20 md:pt-16 md:pb-24">
        <Suspense fallback={<Skeleton className="h-[30rem] w-full rounded-2xl md:h-72" />}>
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

async function MainHero() {
  let products: ProductSummary[];
  try {
    products = (await getProducts({ limit: HERO_LIMIT })).items;
  } catch {
    return null; // 배너는 부가 영역이라 실패 시 숨기고, 아래 상품 영역에서 에러를 안내합니다.
  }
  if (products.length === 0) return null;

  // 배너 좌우 그라데이션에 쓰는 아티스트 시그니처 컬러. 못 불러오면 브랜드 색으로 대체
  const artists = await getArtists().catch((): Artist[] => []);
  const themeColors = Object.fromEntries(artists.map((artist) => [artist.slug, artist.themeColor]));
  return <MainHeroCarousel products={products} themeColors={themeColors} />;
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
    <div className="space-y-6 md:space-y-10">
      {artists.map((artist) => (
        <Suspense key={artist.id} fallback={<ArtistShowcaseSkeleton />}>
          <ArtistShowcase artist={artist} />
        </Suspense>
      ))}
    </div>
  );
}
