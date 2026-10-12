import Link from "next/link";
import { Skeleton } from "@/components/ui";
import { getProducts } from "@/services/products";
import type { Artist, ProductSummary } from "@/types/app";
import { artistThemeStyle } from "./artistTheme";
import { LoadError } from "./LoadError";
import { ProductCarousel } from "./ProductCarousel";

const SHOWCASE_LIMIT = 15; // PC 5개씩 최대 3페이지

// 메인 페이지 아티스트별 굿즈 패널 (위버스샵 아티스트 섹션 참고)
export async function ArtistShowcase({ artist }: { artist: Artist }) {
  let products: ProductSummary[];
  try {
    products = (await getProducts({ artistSlug: artist.slug, limit: SHOWCASE_LIMIT })).items;
  } catch (error) {
    return <LoadError error={error} retryHref="/" />;
  }

  return (
    <article className="reveal overflow-hidden rounded-xl bg-white shadow-card">
      <Link
        href={`/artists/${artist.slug}`}
        style={{
          ...artistThemeStyle(artist.themeColor),
          background: "linear-gradient(110deg, var(--artist-color), color-mix(in srgb, var(--artist-color) 65%, white))",
        }}
        className="group relative isolate flex h-14 items-center px-5 md:h-16 md:px-6"
      >
        <div className="absolute inset-0 -z-10 bg-linear-to-r from-black/35 via-black/10 to-transparent" aria-hidden="true" />
        <div className="text-white">
          <h2 className="flex items-center gap-1 text-lg font-black tracking-tight md:text-xl">
            {artist.name}
            <span aria-hidden="true" className="text-base font-normal transition-transform group-hover:translate-x-1">›</span>
          </h2>
        </div>
      </Link>
      <div className="p-4 md:p-5">
        {products.length > 0 ? (
          <ProductCarousel products={products} label={artist.name} />
        ) : (
          <p className="py-10 text-center text-sm text-muted">아직 등록된 굿즈가 없어요.</p>
        )}
      </div>
    </article>
  );
}

export function ArtistShowcaseSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-card" aria-busy="true" aria-label="아티스트 굿즈를 불러오는 중">
      <Skeleton className="h-14 w-full rounded-none md:h-16" />
      <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-4 md:p-5 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="aspect-square w-full" />
        ))}
      </div>
    </div>
  );
}
