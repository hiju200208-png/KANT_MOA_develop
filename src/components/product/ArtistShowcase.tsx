import Link from "next/link";
import { Skeleton } from "@/components/ui";
import { getProducts } from "@/services/products";
import type { Artist, ProductSummary } from "@/types/app";
import { artistThemeStyle } from "./artistTheme";
import { LoadError } from "./LoadError";
import { ProductCarousel } from "./ProductCarousel";

const SHOWCASE_LIMIT = 12; // 4개씩 최대 3페이지

// 메인 페이지 아티스트별 굿즈 패널 (위버스샵 아티스트 섹션 참고)
export async function ArtistShowcase({ artist }: { artist: Artist }) {
  let products: ProductSummary[];
  try {
    products = (await getProducts({ artistSlug: artist.slug, limit: SHOWCASE_LIMIT })).items;
  } catch (error) {
    return <LoadError error={error} retryHref="/" />;
  }

  return (
    <article className="overflow-hidden rounded-lg bg-white shadow-card">
      <Link
        href={`/artists/${artist.slug}`}
        style={{
          ...artistThemeStyle(artist.themeColor),
          background: "linear-gradient(110deg, var(--artist-color), color-mix(in srgb, var(--artist-color) 65%, white))",
        }}
        className="group relative isolate flex h-20 items-end px-5 pb-3 md:h-24 md:px-6 md:pb-4"
      >
        <div className="absolute inset-0 -z-10 bg-linear-to-r from-black/35 via-black/10 to-transparent" aria-hidden="true" />
        <div className="text-white">
          <span className="rounded bg-black/60 px-1.5 py-0.5 text-xs font-bold">Now</span>
          <h2 className="mt-1.5 flex items-center gap-1 text-2xl font-black tracking-tight md:text-3xl">
            {artist.name}
            <span aria-hidden="true" className="text-xl font-normal transition-transform group-hover:translate-x-1">›</span>
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
    <div className="overflow-hidden rounded-lg bg-white shadow-card" aria-busy="true" aria-label="아티스트 굿즈를 불러오는 중">
      <Skeleton className="h-20 w-full rounded-none md:h-24" />
      <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-4 md:p-5">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="aspect-square w-full" />
        ))}
      </div>
    </div>
  );
}
