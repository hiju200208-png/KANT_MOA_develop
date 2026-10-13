"use client";

import Link from "next/link";
import { useState } from "react";
import { SearchIcon } from "@/components/layout/Icons";
import { Input, Modal } from "@/components/ui";
import type { Artist } from "@/types/app";
import { ArtistLogo } from "@/components/artist/ArtistLogo";

// 로고 타일 + 이름. 마우스를 올리면 살짝 떠오른다
function ArtistTile({ artist }: { artist: Artist }) {
  return (
    <Link href={`/artists/${artist.slug}`} className="group flex w-16 flex-col items-center gap-1 md:w-18">
      <span className="transition-transform duration-300 group-hover:-translate-y-1 group-focus-visible:-translate-y-1 motion-reduce:transition-none">
        <ArtistLogo artist={artist} size="lg" />
      </span>
      <span className="text-center text-xs leading-snug font-medium break-all">{artist.name}</span>
    </Link>
  );
}

// 메인 "Recommended Artist" 영역 (위버스샵 수치 참고: 제목 18px, 로고 72px, 간격 12px, 모서리 16px): 로고를 누르면 아티스트 굿즈 페이지로, 아래 검색 바는 아티스트 검색 창을 엽니다.
export function ArtistPicker({ artists }: { artists: Artist[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const keyword = query.trim().toLowerCase();
  const results = keyword
    ? artists.filter((artist) => [artist.name, artist.nameKo, artist.slug].some((text) => text.toLowerCase().includes(keyword)))
    : artists;

  function handleClose() {
    setOpen(false);
    setQuery("");
  }

  return (
    <section aria-labelledby="our-artists" className="rounded-[16px] bg-white p-4 shadow-[0_4px_28px_rgb(0_0_0/0.12)]">
      <h2 id="our-artists" className="text-lg font-bold">Recommended Artist</h2>

      <ul className="mt-2 flex gap-3 overflow-x-auto pt-1 pb-1">
        {artists.map((artist) => (
          <li key={artist.id} className="shrink-0">
            <ArtistTile artist={artist} />
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="brand-gradient-soft-hover mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-line bg-white text-sm font-bold hover:border-neutral-400"
      >
        <SearchIcon className="size-4" />
        아티스트
      </button>

      <Modal open={open} onClose={handleClose} title="아티스트 검색">
        <Input
          name="artist-search"
          label="아티스트 이름"
          placeholder="예: ORBIT:ON, 오르빗온"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus
        />
        {results.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted">검색 결과가 없어요.</p>
        ) : (
          <ul className="mt-4 max-h-80 divide-y divide-line overflow-y-auto">
            {results.map((artist) => (
              <li key={artist.id}>
                <Link href={`/artists/${artist.slug}`} onClick={handleClose} className="brand-gradient-soft-hover flex items-center gap-3 rounded-md px-2 py-3">
                  <ArtistLogo artist={artist} size="sm" />
                  <span className="text-foreground">
                    <span className="block text-sm font-bold">{artist.name}</span>
                    <span className="block text-xs text-muted">{artist.nameKo}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </section>
  );
}
