import Link from "next/link";
import { getArtistNotices } from "@/mocks/notices";
import type { Artist } from "@/types/app";

interface ArtistNoticesProps {
  artist: Pick<Artist, "slug" | "name">;
}

// 아티스트 페이지 오른쪽 Notice 영역 (위버스샵 아티스트 페이지 참고)
export function ArtistNotices({ artist }: ArtistNoticesProps) {
  const notices = getArtistNotices(artist.slug);

  return (
    <section aria-labelledby="artist-notice-title" className="rounded-2xl border border-line bg-white p-5 md:p-6 lg:sticky lg:top-24">
      <h2 id="artist-notice-title" className="text-xl font-black">
        Notice
      </h2>
      {notices.length === 0 ? (
        <p className="mt-4 rounded-xl border border-line p-4 text-sm text-muted">등록된 공지가 없어요.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {notices.map((notice) => (
            <li key={notice.id}>
              <Link
                href={`/artists/${artist.slug}/notices/${notice.id}`}
                className="group block rounded-xl border border-line p-4 transition-colors hover:border-violet-300 hover:bg-violet-50/40"
              >
                <span className="inline-block rounded border border-line px-1.5 py-0.5 text-xs font-bold text-muted">{artist.name}</span>
                <p className="mt-2 text-sm font-semibold leading-snug group-hover:underline">
                  {notice.title}
                  {notice.isNew && (
                    <span className="ml-1.5 inline-grid size-4 place-items-center rounded-full bg-red-500 align-[-2px] text-[10px] font-black text-white">
                      <span aria-hidden="true">N</span>
                      <span className="sr-only">새 공지</span>
                    </span>
                  )}
                </p>
                <time dateTime={notice.publishedAt} className="mt-1.5 block text-xs text-muted">
                  {notice.publishedAt.replaceAll("-", ".")}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
