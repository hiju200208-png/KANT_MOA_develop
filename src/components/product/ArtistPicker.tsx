"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { SearchIcon } from "@/components/layout/Icons";
import { Input, Modal } from "@/components/ui";
import type { Artist } from "@/types/app";
import { ArtistLogo } from "./ArtistLogo";

// 카드 태그라인은 DB에 없는 마케팅 카피라 프론트 상수로 둔다. slug가 없으면 한글 이름을 보여준다.
const ARTIST_TAGLINE: Record<string, string> = {
  "orbit-on": "A BRIGHTER TOMORROW",
  daylog: "RECORD OUR DAYS",
  sodafm: "PLAY OUR COLOR",
};

// 흰 바탕 텍스트 카드. 마우스를 올리거나 키보드로 선택하면 카드 아래로 시그니처 컬러 빛이 은은하게 번진다.
function ArtistCard({ artist }: { artist: Artist }) {
  const color = artist.themeColor ?? "var(--brand)";
  const glow = { "--glow": `color-mix(in oklab, ${color} 85%, transparent)` } as CSSProperties;

  return (
    <Link
      href={`/artists/${artist.slug}`}
      style={glow}
      className="group flex items-end justify-between gap-4 rounded-2xl bg-white p-6 shadow-card transition-[translate,box-shadow] md:p-7 duration-300 hover:-translate-y-1 hover:shadow-[0_16px_44px_-6px_var(--glow)] focus-visible:-translate-y-1 focus-visible:shadow-[0_16px_44px_-6px_var(--glow)] motion-reduce:transition-none"
    >
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-muted">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          {ARTIST_TAGLINE[artist.slug] ?? artist.nameKo}
        </p>
        <h3 className="mt-3 text-2xl font-black tracking-tight">{artist.name}</h3>
      </div>
      <span aria-hidden="true" className="shrink-0 text-muted transition-transform group-hover:translate-x-1 group-hover:text-foreground">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </Link>
  );
}

// 메인 "ARTIST" 영역: 아티스트 카드를 누르면 아티스트 굿즈 페이지로, 아래 검색 바는 아티스트 검색 창을 엽니다.
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
    <section aria-labelledby="our-artists">
      <div className="mb-5 flex flex-col gap-1.5 md:mb-6 md:flex-row md:items-end md:justify-between">
        <h2 id="our-artists" className="text-base font-semibold tracking-wide text-muted md:text-lg">
          ARTIST
        </h2>
        <p className="text-sm text-muted">각기 다른 빛으로, 더 특별한 이야기를 만들어가는 아티스트들을 만나보세요.</p>
      </div>

      <ul className="grid gap-4 md:grid-cols-3 md:gap-6">
        {artists.map((artist) => (
          <li key={artist.id}>
            <ArtistCard artist={artist} />
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="brand-gradient-soft-hover mt-4 flex h-11 w-full items-center gap-2 rounded-full border border-line bg-white px-4 text-left text-sm text-muted hover:border-violet-300 md:mt-5"
      >
        <SearchIcon className="size-4 text-foreground" />
        아티스트를 검색해보세요.
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
