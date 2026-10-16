import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArtistBanners, ArtistBannersSkeleton } from "@/components/artist/ArtistBanners";
import { ArtistLikeButton } from "@/components/artist/ArtistLikeButton";
import { ArtistCategoryTabs } from "@/components/artist/ArtistCategoryTabs";
import { ArtistNotices } from "@/components/artist/ArtistNotices";
import type { SearchParams } from "@/components/product/listParams";
import { LoadError } from "@/components/product/LoadError";
import { ProductGridSkeleton } from "@/components/product/ProductGrid";
import { ProductListSection } from "@/components/product/ProductListSection";
import { Skeleton } from "@/components/ui";
import { getArtist, getArtistLikeCounts } from "@/services/artists";
import { getCategories } from "@/services/products";
import type { Artist, Category } from "@/types/app";

interface ArtistPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}

export default function ArtistPage({ params, searchParams }: ArtistPageProps) {
  return (
    <Suspense fallback={<ArtistPageSkeleton />}>
      <ArtistContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ArtistContent({ params, searchParams }: ArtistPageProps) {
  const { slug } = await params;

  let artist: Artist | null;
  try {
    artist = await getArtist(slug);
  } catch (error) {
    return (
      <div className="content-shell py-8 md:py-12">
        <LoadError error={error} retryHref={`/artists/${slug}`} />
      </div>
    );
  }
  if (!artist) notFound();

  // 카테고리 탭: 목록을 못 불러오면 탭만 숨기고 전체 상품을 보여줌
  const categories = await getCategories().catch((): Category[] => []);
  // 좋아요 수를 못 불러오면 0으로 보여줌 (버튼은 계속 누를 수 있음)
  const likeCounts = await getArtistLikeCounts().catch((): Record<number, number> => ({}));
  const query = await searchParams;
  const category = categories.find((item) => item.slug === query.category)?.slug;
  const basePath = `/artists/${artist.slug}`;
  const listPath = category ? `${basePath}?category=${category}` : basePath;

  return (
    <div className="content-shell py-6 md:py-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-black md:text-2xl">{artist.name}</h1>
        <ArtistLikeButton slug={artist.slug} name={artist.name} initialCount={likeCounts[artist.id] ?? 0} />
      </div>
      <Suspense fallback={<ArtistBannersSkeleton />}>
        <ArtistBanners artist={artist} />
      </Suspense>
      {/* 위버스샵 아티스트 페이지처럼 왼쪽 상품(카테고리 탭), 오른쪽 공지 */}
      <div className="mt-8 grid grid-cols-1 gap-6 md:mt-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <section id="artist-products" aria-labelledby="artist-products-title" className="scroll-mt-24 rounded-2xl border border-line bg-white px-4 py-5 md:p-6">
          <h2 id="artist-products-title" className="text-xl font-black">
            Products
          </h2>
          {categories.length > 0 && (
            <div className="mt-4">
              <ArtistCategoryTabs basePath={basePath} categories={categories} current={category} />
            </div>
          )}
          <div className="mt-6">
            <Suspense key={category ?? "all"} fallback={<ProductGridSkeleton />}>
              <ProductListSection filter={{ artistSlug: artist.slug, categorySlug: category }} basePath={listPath} searchParams={searchParams} />
            </Suspense>
          </div>
        </section>
        <ArtistNotices artist={artist} />
      </div>
    </div>
  );
}

function ArtistPageSkeleton() {
  return (
    <div className="content-shell py-6 md:py-10">
      <ArtistBannersSkeleton />
      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ProductGridSkeleton />
        <Skeleton className="hidden h-96 rounded-2xl lg:block" />
      </div>
    </div>
  );
}
