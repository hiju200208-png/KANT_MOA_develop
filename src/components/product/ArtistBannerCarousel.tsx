"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { useSwipe } from "./useSwipe";

const SETTLE_FALLBACK_MS = 800;

export type ArtistBanner = {
  key: string;
  href: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  imageAlt: string;
  variant: "cover" | "product"; // cover: 배경 꽉 채움, product: 오른쪽에 상품 이미지
};

interface ArtistBannerCarouselProps {
  banners: ArtistBanner[];
  themeStyle: CSSProperties;
}

// 위버스샵 아티스트 상단처럼 배너 2개씩 보이는 캐러셀 (모바일은 1개)
export function ArtistBannerCarousel({ banners, themeStyle }: ArtistBannerCarouselProps) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);

  function handleScroll() {
    const track = trackRef.current;
    const first = track?.firstElementChild as HTMLElement | null;
    if (!track || !first) return;
    setActive(Math.round(track.scrollLeft / first.offsetWidth));
  }

  function handleMove(direction: 1 | -1) {
    trackRef.current?.scrollBy({ left: direction * trackRef.current.clientWidth, behavior: "smooth" });
  }

  // 마우스로 끌어서 넘기기 (터치는 브라우저 기본 스크롤 사용). 끄는 동안은 스냅을 끄고 손을 따라 움직인다.
  const dragStart = useRef(0);
  const [settling, setSettling] = useState(false); // 놓은 뒤 제자리로 미끄러지는 동안은 스냅을 꺼 둔다
  const scrollFromDragStart = (offset: number) => {
    setSettling(true);
    trackRef.current?.scrollTo({ left: dragStart.current + offset, behavior: "smooth" });
  };
  const { dragX, dragging, handlers } = useSwipe({
    enabled: banners.length > 1,
    mouseOnly: true,
    onSwipe: (step) => scrollFromDragStart(step * (trackRef.current?.clientWidth ?? 0)),
    onCancel: () => scrollFromDragStart(0),
  });

  useEffect(() => {
    if (dragging && trackRef.current) trackRef.current.scrollLeft = dragStart.current - dragX;
  }, [dragging, dragX]);

  useEffect(() => {
    const track = trackRef.current;
    if (!settling || !track) return;
    const done = () => setSettling(false);
    track.addEventListener("scrollend", done, { once: true });
    const timer = window.setTimeout(done, SETTLE_FALLBACK_MS); // scrollend 미지원 브라우저 대비
    return () => {
      track.removeEventListener("scrollend", done);
      window.clearTimeout(timer);
    };
  }, [settling]);

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    dragStart.current = trackRef.current?.scrollLeft ?? 0;
    handlers.onPointerDown(event);
  }

  const arrowClass = "absolute top-1/2 z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white text-lg shadow-card md:grid";

  return (
    <section aria-label="아티스트 배너" className="relative" style={themeStyle}>
      <ul
        ref={trackRef}
        onScroll={handleScroll}
        {...handlers}
        onPointerDown={handlePointerDown}
        className={`-mx-2 flex overflow-x-auto select-none [scrollbar-width:none] ${dragging ? "cursor-grabbing" : settling ? "" : "snap-x snap-mandatory scroll-smooth"}`}
      >
        {banners.map((banner) => (
          <li key={banner.key} className="shrink-0 basis-full snap-start px-2 md:basis-1/2">
            <BannerCard banner={banner} />
          </li>
        ))}
      </ul>
      {banners.length > 2 && (
        <>
          <button type="button" aria-label="이전 배너" onClick={() => handleMove(-1)} className={`${arrowClass} -left-5`}>‹</button>
          <button type="button" aria-label="다음 배너" onClick={() => handleMove(1)} className={`${arrowClass} -right-5`}>›</button>
        </>
      )}
      {banners.length > 1 && (
        <div className="mt-4 flex justify-center gap-1" aria-hidden="true">
          {banners.map((banner, index) => (
            <span key={banner.key} className={`h-0.5 w-6 rounded-full ${index === active ? "bg-foreground" : "bg-line"}`} />
          ))}
        </div>
      )}
    </section>
  );
}

function BannerCard({ banner }: { banner: ArtistBanner }) {
  return (
    <Link href={banner.href} className="group relative isolate flex aspect-video items-end overflow-hidden rounded-lg bg-linear-to-br from-(--artist-color) to-foreground p-6 md:p-8">
      {banner.imageUrl && banner.variant === "cover" && (
        <Image src={banner.imageUrl} alt={banner.imageAlt} fill sizes="(min-width: 768px) 50vw, 100vw" loading="eager" className="-z-10 object-cover" />
      )}
      {banner.imageUrl && banner.variant === "product" && (
        // 정사각형 상품 이미지는 메인 배너처럼 띄우고 아래에 옅은 반사를 둔다 (위버스샵 배너 참고)
        <div className="absolute top-[12%] right-[10%] -z-10 aspect-square h-[60%] transition-transform duration-500 group-hover:scale-[1.03]">
          <div className="relative size-full overflow-hidden rounded-sm shadow-[0_12px_28px_rgb(0_0_0/0.35)]">
            <Image src={banner.imageUrl} alt={banner.imageAlt} fill sizes="(min-width: 768px) 15vw, 40vw" className="object-cover" />
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-full mt-1 h-2/5 overflow-hidden opacity-30 [mask-image:linear-gradient(to_bottom,black,transparent)]">
            <div className="relative aspect-square w-full -scale-y-100">
              <Image src={banner.imageUrl} alt="" fill sizes="(min-width: 768px) 15vw, 40vw" loading="lazy" className="object-cover" />
            </div>
          </div>
        </div>
      )}
      <div className="absolute inset-0 -z-10 bg-linear-to-t from-black/60 via-black/10 to-transparent" aria-hidden="true" />
      <div className="w-3/5 text-white">
        <h2 className="text-xl font-black leading-snug md:text-2xl">{banner.title}</h2>
        <p className="mt-1.5 text-sm opacity-90">{banner.subtitle}</p>
      </div>
    </Link>
  );
}
