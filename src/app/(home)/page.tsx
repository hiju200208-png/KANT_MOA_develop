import { Suspense } from "react";
import { ArtistPicker } from "@/components/home/ArtistPicker";
import { ArtistShowcase, ArtistShowcaseSkeleton } from "@/components/home/ArtistShowcase";
import { LoadError } from "@/components/product/LoadError";
import { HomeSpotlight, type SpotlightArtist } from "@/components/home/HomeSpotlight";
import { EmptyState, Skeleton } from "@/components/ui";
import { getArtists, getBestProducts, getProducts } from "@/services/products";
import type { Artist, BestProduct, ProductSummary } from "@/types/app";

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
      </div>
    </>
  );
}

const BANNER_EXCLUDED = ["orbit-on", "daylog", "sodafm"]; // 메인 배너에서 빼는 아티스트 (팀이 만든 가상 아티스트)
const NEW_RELEASE_DAYS = 30; // 발매일이 이 기간 안이거나 앞으로 발매될 상품을 NEW로
const ARTIST_PRODUCTS_LIMIT = 100; // NEW 후보를 찾을 때 읽는 아티스트별 상품 수
const DAY_MS = 24 * 60 * 60 * 1000;

// 대표 상품 고르기: 발매일(release_date)이 최근 30일 안이거나 곧 발매되는 신보·신상품이 있으면 그중 가장 늦게 발매되는 것을 NEW,
// 없으면 최근 7일 판매 1위 BEST. (created_at은 데이터 등록 시각이라 기준으로 쓰지 않음)
function pickSpotlight(products: ProductSummary[], best: BestProduct | undefined): SpotlightArtist["pick"] {
  const since = new Date(Date.now() - NEW_RELEASE_DAYS * DAY_MS).toISOString().slice(0, 10);
  const releases = products.filter((p) => p.releaseDate && p.releaseDate >= since).sort((a, b) => b.releaseDate!.localeCompare(a.releaseDate!));
  if (releases[0]) return { kind: "NEW", product: releases[0] };
  return best ? { kind: "BEST", product: best } : undefined;
}

// 메인 배너: 아티스트마다 한 장. 대표 상품은 NEW(신보·신상품) 또는 BEST(최근 7일 판매 1위)
// (영상이 있는 아티스트는 HomeSpotlight에서 COMEBACK 영상 슬라이드로 바뀜. 대표 상품을 못 불러온 아티스트는 빠짐)
async function MainHero() {
  let artists: Artist[];
  try {
    artists = await getArtists();
  } catch {
    return null; // 배너는 부가 영역이라 실패 시 숨기고, 아래 상품 영역에서 에러를 안내합니다.
  }
  artists = artists.filter((artist) => !BANNER_EXCLUDED.includes(artist.slug));
  const [bests, catalogs] = await Promise.all([
    Promise.all(artists.map((artist) => getBestProducts({ limit: 1, artistSlug: artist.slug }).catch((): BestProduct[] => []))),
    Promise.all(
      artists.map((artist) =>
        getProducts({ artistSlug: artist.slug, limit: ARTIST_PRODUCTS_LIMIT })
          .then((list) => list.items)
          .catch((): ProductSummary[] => []),
      ),
    ),
  ]);
  const slides: SpotlightArtist[] = artists
    .map(({ id, slug, name, nameKo, tagline, themeColor }, i) => ({ id, slug, name, nameKo, tagline, themeColor, pick: pickSpotlight(catalogs[i], bests[i][0]) }))
    .filter((artist) => artist.pick !== undefined);
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
