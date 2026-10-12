import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { artistThemeStyle } from "@/components/product/artistTheme";
import { LoadError } from "@/components/product/LoadError";
import { MemberCard } from "@/components/product/MemberCard";
import { EmptyState, Skeleton } from "@/components/ui";
import { getArtist, getArtistMembers } from "@/services/products";
import type { Artist, ArtistMember } from "@/types/app";

interface ArtistAboutPageProps {
  params: Promise<{ slug: string }>;
}

export default function ArtistAboutPage({ params }: ArtistAboutPageProps) {
  return (
    <div className="content-shell py-6 md:py-10">
      <Suspense fallback={<AboutSkeleton />}>
        <AboutContent params={params} />
      </Suspense>
    </div>
  );
}

async function AboutContent({ params }: ArtistAboutPageProps) {
  const { slug } = await params;

  let artist: Artist | null;
  let members: ArtistMember[];
  try {
    [artist, members] = await Promise.all([getArtist(slug), getArtistMembers(slug)]);
  } catch (error) {
    return <LoadError error={error} retryHref={`/artists/${slug}/about`} />;
  }
  if (!artist) notFound();

  return (
    <div style={artistThemeStyle(artist.themeColor)}>
      <section aria-label={`${artist.name} 소개`} className="relative isolate flex aspect-video items-end overflow-hidden rounded-lg bg-linear-to-br from-(--artist-color) to-foreground p-6 md:aspect-auto md:h-96 md:p-10">
        {artist.heroImageUrl && (
          <Image src={artist.heroImageUrl} alt={`${artist.name} 단체 사진`} fill sizes="(min-width: 1200px) 1200px, 100vw" loading="eager" fetchPriority="high" className="-z-10 object-cover" />
        )}
        <div className="absolute inset-0 -z-10 bg-linear-to-t from-black/70 via-black/10 to-transparent" aria-hidden="true" />
        <div className="text-white">
          <p className="text-sm font-semibold opacity-80">{artist.nameKo}</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight md:text-5xl">{artist.name}</h1>
          {members.length > 0 && <p className="mt-2 text-sm opacity-90">{members.map((member) => member.name).join(" · ")}</p>}
        </div>
      </section>

      <section aria-label="멤버 소개" className="mt-10 md:mt-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="text-xl font-black md:text-2xl">멤버 소개</h2>
          <Link href={`/artists/${artist.slug}`} className="brand-gradient-text-hover shrink-0 text-sm font-bold text-muted">
            굿즈 보러가기 <span aria-hidden="true">›</span>
          </Link>
        </div>
        {members.length === 0 ? (
          <EmptyState title="멤버 정보가 아직 없어요" description="곧 멤버 소개로 찾아올게요." />
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {members.map((member) => (
              <li key={member.id}>
                <MemberCard member={member} artistName={artist.name} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AboutSkeleton() {
  return (
    <div aria-busy="true" aria-label="아티스트 소개를 불러오는 중">
      <Skeleton className="aspect-video w-full rounded-lg md:aspect-auto md:h-96" />
      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:mt-14 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-80 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
