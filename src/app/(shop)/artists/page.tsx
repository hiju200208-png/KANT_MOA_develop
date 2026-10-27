import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { io } from "next/cache";
import { EmptyState, PageTitle, Skeleton } from "@/components/ui";
import { artistThemeStyle } from "@/components/artist/artistTheme";
import { LoadError } from "@/components/product/LoadError";
import { getArtists } from "@/services/artists";
import type { Artist } from "@/types/app";

export const metadata: Metadata = { title: "아티스트" };

// 아티스트 목록 (모바일 하단 메뉴 "아티스트"의 도착 페이지). 카드를 누르면 아티스트 굿즈 페이지로 이동
export default function ArtistsPage() {
  return (
    <div className="content-shell py-8 md:py-12">
      <PageTitle title="아티스트" description="좋아하는 아티스트의 공식 굿즈를 만나보세요." />
      <Suspense fallback={<ArtistListSkeleton />}>
        <ArtistList />
      </Suspense>
    </div>
  );
}

async function ArtistList() {
  await io();
  let artists: Artist[];
  try {
    artists = await getArtists();
  } catch (error) {
    return <LoadError error={error} retryHref="/artists" />;
  }
  if (artists.length === 0) return <EmptyState title="등록된 아티스트가 없어요" />;

  return (
    <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 md:gap-6">
      {artists.map((artist, index) => (
        <li key={artist.id} className="reveal">
          <ArtistCard artist={artist} priority={index === 0} />
        </li>
      ))}
    </ul>
  );
}

function ArtistCard({ artist, priority }: { artist: Artist; priority: boolean }) {
  return (
    <Link
      href={`/artists/${artist.slug}`}
      style={artistThemeStyle(artist.themeColor)}
      className="group relative isolate flex aspect-[4/3] items-end overflow-hidden rounded-2xl bg-linear-to-br from-(--artist-color) to-foreground p-6 shadow-card"
    >
      {artist.heroImageUrl && (
        <Image
          src={artist.heroImageUrl}
          alt=""
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
          loading={priority ? "eager" : "lazy"}
          className="-z-10 object-cover transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transition-none"
        />
      )}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-t from-black/65 via-black/15 to-transparent" />
      <div className="flex w-full items-end gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-black tracking-tight text-white">{artist.name}</h2>
          <p className="mt-0.5 text-sm text-white/80">{artist.nameKo}</p>
        </div>
        <span className="shrink-0 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-foreground transition-transform group-hover:translate-x-0.5">
          굿즈 보기 ›
        </span>
      </div>
    </Link>
  );
}

function ArtistListSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 md:gap-6" aria-busy="true" aria-label="아티스트를 불러오는 중">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="aspect-[4/3] w-full rounded-2xl" />
      ))}
    </div>
  );
}
