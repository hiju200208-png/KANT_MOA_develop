"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { TopBar } from "@/components/layout/TopBar";
import type { Artist, BestProduct } from "@/types/app";
import { artistThemeStyle } from "./artistTheme";
import { useSwipe } from "./useSwipe";

export type SpotlightArtist = Pick<Artist, "id" | "slug" | "name" | "nameKo" | "tagline" | "themeColor"> & { products: BestProduct[] };

const AUTO_SLIDE_MS = 7000;
const STACK_COUNT = 3; // 오른쪽에 겹쳐 놓는 상품 수

// 아티스트 테마 색으로 만든 파스텔 배경 (흰색을 많이 섞어 글자 대비 유지)
const bandStyle: CSSProperties = {
  backgroundColor: "color-mix(in srgb, var(--artist-color) 14%, white)",
  backgroundImage:
    "radial-gradient(1100px 560px at 72% 42%, color-mix(in srgb, var(--artist-color) 10%, white) 0%, color-mix(in srgb, var(--artist-color) 22%, white) 55%, color-mix(in srgb, var(--artist-color) 16%, #eef2fb) 100%)",
};

// 상품 카드를 부채꼴로 겹쳐 놓는 위치 (가운데 → 오른쪽 위 → 왼쪽 아래)
const STACK_POSITION = [
  "left-[22%] top-[6%] z-20 w-[52%] rotate-[-3deg]",
  "right-0 top-[2%] z-10 w-[38%] rotate-[7deg]",
  "left-0 bottom-[4%] z-30 w-[36%] rotate-[-8deg]",
];

function chipLabel(product: BestProduct) {
  if (product.isLimited) return "한정";
  if (product.isPreorder) return "예약 판매";
  return product.category.name;
}

function Slide({ artist, active }: { artist: SpotlightArtist; active: boolean }) {
  const stack = artist.products.slice(0, STACK_COUNT);
  return (
    <li aria-roledescription="slide" aria-label={artist.name} aria-hidden={!active} inert={!active} style={artistThemeStyle(artist.themeColor)} className="w-full shrink-0">
      <div className="content-shell">
        <div className="grid items-center gap-6 pt-4 pb-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-10 md:pt-6 md:pb-10">
          <div className="flex flex-col gap-2.5 md:gap-3.5">
            <span style={{ color: "color-mix(in srgb, var(--artist-color) 55%, #111214)" }} className="text-xs font-bold tracking-[0.14em] md:text-sm">{artist.name} · OFFICIAL GOODS</span>
            <h2 className="text-[26px] leading-tight font-bold break-keep md:text-[44px]">{artist.tagline ?? `${artist.nameKo} 공식 굿즈`}</h2>
            <p className="text-sm text-foreground/80 md:text-base">앨범부터 응원봉, 한정 굿즈까지 한 곳에서</p>
          </div>

          {stack.length > 0 && (
            <div className="relative mx-auto aspect-[16/11] w-full max-w-md md:max-w-xl">
              <span aria-hidden="true" className="absolute top-1/2 left-1/2 aspect-square h-[92%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/55" />
              {stack.map((product, i) => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  draggable={false}
                  className={`absolute aspect-square overflow-hidden rounded-[18px] bg-[#ededed] shadow-[0_18px_36px_-12px_rgb(40_30_90/0.35)] transition-transform duration-300 hover:-translate-y-1 hover:rotate-0 motion-reduce:transition-none ${STACK_POSITION[i]}`}
                >
                  {product.thumbnailUrl && <Image src={product.thumbnailUrl} alt={`${product.artist.name} ${product.name}`} fill sizes="(min-width: 768px) 22vw, 45vw" priority={active && i === 0} className="object-cover" />}
                  <span className="absolute top-2.5 left-2.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold shadow-sm md:text-xs">{chipLabel(product)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>
    </li>
  );
}

// 메인 배너 (시안 C · 파스텔 스포트라이트) 슬라이드: 아티스트마다 한 장 (문구 + 겹친 인기 상품 3개).
// 7초마다 자동으로 넘어가고, 마우스로 끌거나 손가락으로 밀어서·위 버튼으로 넘김. 배경 톤도 아티스트 색으로 바뀜
export function HomeSpotlight({ artists }: { artists: SpotlightArtist[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = artists.length;
  const move = (step: number) => setIndex((current) => (current + step + count) % count);
  const { dragX, dragging, handlers } = useSwipe({ enabled: count > 1, onSwipe: move });

  useEffect(() => {
    if (count < 2 || paused || dragging) return;
    const timer = window.setTimeout(() => {
      if (!document.hidden) setIndex((current) => (current + 1) % count);
    }, AUTO_SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [index, count, paused, dragging]);

  const artist = artists[index];
  return (
    <section
      aria-roledescription="carousel"
      aria-label="메인 배너"
      style={{ ...artistThemeStyle(artist?.themeColor ?? null), ...bandStyle }}
      className="transition-[background-color] duration-700"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <TopBar showBack={false} />

      {count > 1 && (
        <div className="content-shell flex items-center gap-1 overflow-x-auto pt-1 [scrollbar-width:none]" role="group" aria-label="아티스트 선택">
          {artists.map((item, i) => {
            const active = i === index;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setIndex(i)}
                className={`h-7 shrink-0 rounded-full px-3 text-xs whitespace-nowrap transition-colors ${active ? "bg-foreground font-bold text-white" : "border border-black/15 bg-white/70 hover:bg-white"}`}
              >
                {item.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="overflow-hidden">
        <ul
          className={`flex touch-pan-y select-none ${dragging ? "cursor-grabbing" : "transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"}`}
          style={{ transform: `translateX(calc(-${index * 100}% + ${dragX}px))` }}
          {...handlers}
        >
          {artists.map((item, i) => (
            <Slide key={item.id} artist={item} active={i === index} />
          ))}
        </ul>
      </div>
    </section>
  );
}
