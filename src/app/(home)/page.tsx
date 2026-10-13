import { Suspense } from "react";
import { ArtistPicker } from "@/components/home/ArtistPicker";
import { ArtistShowcase, ArtistShowcaseSkeleton } from "@/components/home/ArtistShowcase";
import { LoadError } from "@/components/product/LoadError";
import { HomeSpotlight, type SpotlightArtist } from "@/components/home/HomeSpotlight";
import { HERO_VIDEOS } from "@/components/home/heroVideos";
import { EmptyState, Skeleton } from "@/components/ui";
import { sortByArtistLikes } from "@/mocks/artistLikes";
import { getArtists } from "@/services/artists";
import { getBestProducts, getProducts } from "@/services/products";
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
const NEW_RELEASE_DAYS = 30; // 발매일이 이 기간 안이거나 앞으로 발매될 상품은 NEW
const NEW_REGISTERED_DAYS = 14; // 발매일이 없으면 등록 후 이 기간까지 NEW (상품 카드 NEW 배지 badgeRules.ts와 같은 기준)
const ARTIST_PRODUCTS_LIMIT = 100; // NEW 후보를 찾을 때 읽는 아티스트별 상품 수 (최신 등록 순)
const DAY_MS = 24 * 60 * 60 * 1000;

type Pick = NonNullable<SpotlightArtist["pick"]>;

// NEW 후보: 발매일이 최근 30일 안이거나 곧 발매되는 신보 중 가장 늦은 것, 없으면 14일 안에 등록된 가장 최근 상품
function newCandidate(products: ProductSummary[]): Pick | undefined {
  const now = Date.now();
  const since = new Date(now - NEW_RELEASE_DAYS * DAY_MS).toISOString().slice(0, 10);
  const release = products.filter((p) => p.releaseDate && p.releaseDate >= since).sort((a, b) => b.releaseDate!.localeCompare(a.releaseDate!))[0];
  if (release) return { kind: "NEW", product: release };
  const latest = products[0]; // getProducts 기본 정렬: 최신 등록 순
  return latest && now - Date.parse(latest.createdAt) <= NEW_REGISTERED_DAYS * DAY_MS ? { kind: "NEW", product: latest } : undefined;
}

// 메인 배너: 아티스트마다 한 장. 영상이 있는 아티스트는 HomeSpotlight에서 COMEBACK 영상 슬라이드(맨 앞)로 바뀌고,
// 나머지 상품 슬라이드는 NEW(신상품)와 BEST(최근 7일 판매 1위)가 번갈아 나오도록 배정한다. 대표 상품이 없는 아티스트는 빠짐
async function MainHero() {
  let artists: Artist[];
  try {
    artists = await getArtists();
  } catch {
    return null; // 배너는 부가 영역이라 실패 시 숨기고, 아래 상품 영역에서 에러를 안내합니다.
  }
  // 좋아요 많은 아티스트부터 (TODO(mock): 아티스트 좋아요 백엔드 연결 전까지 목 데이터)
  artists = sortByArtistLikes(artists.filter((artist) => !BANNER_EXCLUDED.includes(artist.slug)));
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

  let productSlot = 0; // 영상이 아닌 슬라이드 순번: 짝수 NEW 우선, 홀수 BEST 우선
  const slides: SpotlightArtist[] = artists
    .map(({ id, slug, name, nameKo, tagline, themeColor }, i) => {
      const best: Pick | undefined = bests[i][0] ? { kind: "BEST", product: bests[i][0] } : undefined;
      const fresh = newCandidate(catalogs[i]);
      let pick = best ?? fresh;
      if (!(slug in HERO_VIDEOS)) pick = productSlot++ % 2 === 0 ? (fresh ?? best) : (best ?? fresh);
      return { id, slug, name, nameKo, tagline, themeColor, pick };
    })
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
