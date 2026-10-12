import { Suspense } from "react";
import { ArtistPicker } from "@/components/product/ArtistPicker";
import { ArtistShowcase, ArtistShowcaseSkeleton } from "@/components/product/ArtistShowcase";
import { LoadError } from "@/components/product/LoadError";
import { HomeSpotlight, type SpotlightArtist } from "@/components/product/HomeSpotlight";
import { RecentlyViewedProducts } from "@/components/product/RecentlyViewedProducts";
import { EmptyState, Skeleton } from "@/components/ui";
import { getArtists, getBestProducts } from "@/services/products";
import type { Artist, BestProduct } from "@/types/app";

export default function HomePage() {
  return (
    <>
      <h1 className="sr-only">KANT MOA 공식 굿즈샵</h1>
      <Suspense fallback={<Skeleton className="h-[640px] w-full rounded-none md:h-[600px]" />}>
        <MainHero />
      </Suspense>

      {/* 위버스샵 메인 참고: 카드형 섹션을 16px 간격으로 쌓는다 */}
      <div className="content-shell space-y-4 pt-4 pb-12 md:pb-16">
        <Suspense fallback={<Skeleton className="h-48 w-full rounded-[16px] md:h-52" />}>
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

const SPOTLIGHT_PRODUCTS = 3;

// 메인 배너: 아티스트마다 인기 상품 3개로 한 장씩 (못 불러온 아티스트는 빠짐)
async function MainHero() {
  let artists: Artist[];
  try {
    artists = await getArtists();
  } catch {
    return null; // 배너는 부가 영역이라 실패 시 숨기고, 아래 상품 영역에서 에러를 안내합니다.
  }
  const rankings = await Promise.all(
    artists.map((artist) => getBestProducts({ limit: SPOTLIGHT_PRODUCTS, artistSlug: artist.slug }).catch((): BestProduct[] => [])),
  );
  const slides: SpotlightArtist[] = artists
    .map(({ id, slug, name, nameKo, tagline, themeColor }, i) => ({ id, slug, name, nameKo, tagline, themeColor, products: rankings[i] }))
    .filter((artist) => artist.products.length > 0);
  if (slides.length === 0) return null;
  return <HomeSpotlight artists={slides} />;
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
    <div className="space-y-4">
      {artists.map((artist) => (
        <Suspense key={artist.id} fallback={<ArtistShowcaseSkeleton />}>
          <ArtistShowcase artist={artist} />
        </Suspense>
      ))}
    </div>
  );
}
