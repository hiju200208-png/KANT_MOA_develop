import { Bodoni_Moda } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { artistThemeStyle } from "@/components/artist/artistTheme";
import { LoadError } from "@/components/product/LoadError";
import { MemberGallery } from "@/components/artist/MemberGallery";
import { EmptyState, Skeleton } from "@/components/ui";
import { getArtist, getArtistMembers } from "@/services/products";
import type { Artist, ArtistMember } from "@/types/app";

// 아티스트 이름 워드마크용 (패션 매거진 느낌의 디도 세리프)
const wordmark = Bodoni_Moda({ subsets: ["latin"], weight: ["400"], display: "swap" });

interface ArtistAboutPageProps {
  params: Promise<{ slug: string }>;
}

// 아티스트 프로필 (BELIFT LAB 아티스트 프로필 구조 참고):
// 고정 메뉴 → 단체 사진 → 이름 워드마크 → 슬로건·멤버 정보 → 소개 → 지그재그 멤버 카드 → 굿즈 바로가기
export default function ArtistAboutPage({ params }: ArtistAboutPageProps) {
  return (
    <Suspense fallback={<AboutSkeleton />}>
      <AboutContent params={params} />
    </Suspense>
  );
}

async function AboutContent({ params }: ArtistAboutPageProps) {
  const { slug } = await params;

  let artist: Artist | null;
  let members: ArtistMember[];
  try {
    [artist, members] = await Promise.all([getArtist(slug), getArtistMembers(slug)]);
  } catch (error) {
    return (
      <div className="content-shell py-8 md:py-12">
        <LoadError error={error} retryHref={`/artists/${slug}/about`} />
      </div>
    );
  }
  if (!artist) notFound();

  const artistPath = `/artists/${artist.slug}`;
  const memberNames = members.map((member) => member.name).join(", ");

  return (
    <div style={artistThemeStyle(artist.themeColor)}>
      <nav aria-label={`${artist.name} 메뉴`} className="bg-[#0b0d12] text-white">
        <div className="content-shell flex h-14 items-center justify-between gap-4">
          <Link href={artistPath} className={`${wordmark.className} text-xl tracking-[0.06em] md:text-2xl`}>
            {artist.name}
          </Link>
          <ul className="flex gap-6 text-xs font-bold tracking-[0.16em] md:gap-10 md:text-[13px]">
            <li><span aria-current="page" className="inline-block border-b-2 border-(--artist-color) py-[18px] text-white">PROFILE</span></li>
            <li><Link href={artistPath} className="inline-block border-b-2 border-transparent py-[18px] text-[#9aa0ad] transition-colors hover:text-white">GOODS</Link></li>
          </ul>
        </div>
      </nav>

      <section aria-label={`${artist.name} 단체 사진`} className="relative h-[min(56vh,560px)] min-h-64 overflow-hidden bg-linear-to-br from-(--artist-color) to-foreground">
        {artist.heroImageUrl && (
          <Image src={artist.heroImageUrl} alt={`${artist.name} 단체 사진`} fill sizes="100vw" loading="eager" fetchPriority="high" className="object-cover" />
        )}
      </section>

      <div className="content-shell">
        <header className="reveal px-4 pt-16 pb-12 text-center md:pt-24 md:pb-14">
          <h1 className={`${wordmark.className} text-5xl leading-none tracking-[0.04em] md:text-7xl`}>{artist.name}</h1>
          <p className="mt-4 text-xs font-semibold tracking-[0.5em] text-muted md:text-sm">{artist.nameKo}</p>
        </header>

        <section aria-label="그룹 정보" className="reveal">
          <dl className={`grid border-t border-foreground ${artist.tagline ? "sm:grid-cols-2" : ""}`}>
            {artist.tagline && (
              <div className="px-4 py-8 text-center md:py-10">
                <dt className="text-xs font-bold tracking-[0.24em] text-muted md:text-[13px]">SLOGAN</dt>
                <dd className="mt-4 text-lg font-semibold md:text-2xl">{artist.tagline}</dd>
              </div>
            )}
            <div className="border-t border-line px-4 py-8 text-center sm:border-t-0 sm:[&:nth-child(2)]:border-l md:py-10">
              <dt className="text-xs font-bold tracking-[0.24em] text-muted md:text-[13px]">MEMBER</dt>
              <dd className="mt-4 text-lg font-semibold md:text-2xl">{memberNames || "멤버 정보 준비 중"}</dd>
            </div>
          </dl>
          {members.length > 0 && (
            <p className="border-y border-line border-b-foreground px-2 py-8 text-center text-[15px] leading-8 text-neutral-700 md:px-[8%] md:py-10 md:text-[17px]">
              {artist.name}({artist.nameKo})은 KANT MOA에서 만날 수 있는 {members.length}인조 그룹이에요. {memberNames} {members.length}명의 멤버로 구성되어 있어요.
              {artist.tagline && <> ‘{artist.tagline}’라는 슬로건처럼, 저마다의 색으로 무대를 채워가고 있어요.</>}
            </p>
          )}
        </section>

        <section aria-labelledby="member-title" className="pt-20 pb-24 md:pt-24 md:pb-32">
          <h2 id="member-title" className={`${wordmark.className} reveal mb-14 text-center text-4xl tracking-[0.04em] md:mb-16 md:text-[44px]`}>
            Member
          </h2>
          {members.length === 0 ? (
            <EmptyState title="멤버 정보가 아직 없어요" description="곧 멤버 소개로 찾아올게요." />
          ) : (
            <MemberGallery members={members} artistName={artist.name} />
          )}
        </section>
      </div>

      <section aria-label="굿즈 바로가기" className="reveal bg-linear-to-r from-sky-50 to-white px-4 py-14 text-center">
        <p className="text-[15px] text-neutral-700 md:text-base">{artist.name}의 공식 굿즈를 만나보세요</p>
        <Link href={artistPath} className="mt-5 inline-flex h-13 items-center rounded-full bg-foreground px-8 font-bold transition-colors hover:bg-neutral-800">
          <span className="text-white">{artist.name} 굿즈 보러가기 →</span>
        </Link>
      </section>
    </div>
  );
}

function AboutSkeleton() {
  return (
    <div aria-busy="true" aria-label="아티스트 소개를 불러오는 중">
      <Skeleton className="h-14 w-full rounded-none" />
      <Skeleton className="h-[min(56vh,560px)] w-full rounded-none" />
      <div className="content-shell mt-16 flex flex-wrap justify-center gap-16">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="aspect-1/2 w-[150px] rounded-none sm:w-[250px]" />
        ))}
      </div>
    </div>
  );
}
