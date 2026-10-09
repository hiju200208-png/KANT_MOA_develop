"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import type { ProductSummary } from "@/types/app";
import { formatPrice } from "./formatPrice";

const AUTO_SLIDE_MS = 8000;
const BASE_COLOR = "#1d1f24";
const pad = (n: number) => String(n).padStart(2, "0");

interface MainHeroCarouselProps {
  products: ProductSummary[];
  /** 아티스트 slug → 시그니처 컬러 (artists.theme_color). 없으면 브랜드 색 */
  themeColors: Record<string, string | null>;
}

// 가운데는 시그니처 컬러의 진한 톤(흰 글자가 잘 보이는 밝기), 좌우 끝으로 갈수록 밝은 시그니처 컬러.
// 같은 색상(hue)끼리 oklab으로 섞어 중간이 회색·갈색으로 탁해지지 않게 한다.
// 번지는 폭(--edge)은 화면 폭에 따라 li의 클래스에서 정한다 (모바일은 좁게, 글자를 덮지 않도록).
function slideBackground(color: string): CSSProperties {
  // 파스텔은 채도가 낮아 그대로 어둡게 하면 갈색빛이 돼서 채도를 조금 올리되, 부드럽게 보이도록 밝기는 중간·채도 상한은 낮게 둔다
  // (밝기 0.48이면 흰 글자 명도 대비 약 6:1로 읽기에 충분)
  const deep = `oklch(from ${color} 0.48 min(calc(c * 1.6), 0.1) h)`;
  return {
    // relative color를 지원하지 않는 브라우저용 단색 대체
    backgroundColor: `color-mix(in oklab, ${color} 45%, ${BASE_COLOR})`,
    backgroundImage: `linear-gradient(90deg in oklab, ${color} 0%, ${deep} var(--edge), ${deep} calc(100% - var(--edge)), ${color} 100%)`,
  };
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-9 drop-shadow-[0_1px_3px_rgb(0_0_0/0.5)] md:size-11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

// 메인 상단 전체 폭 배너 (위버스샵 메인 상단 참고). 최신 상품을 한 장씩 슬라이드로 보여줍니다.
export function MainHeroCarousel({ products, themeColors }: MainHeroCarouselProps) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const count = products.length;
  const move = (step: number) => setIndex((current) => (current + step + count) % count);
  const paused = hovered || focused || reducedMotion;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // 8초마다 다음 배너로. 배너를 넘기면(index 변경) 타이머가 처음부터 다시 시작된다.
  useEffect(() => {
    if (count < 2 || paused) return;
    const timer = window.setTimeout(() => {
      if (!document.hidden) setIndex((current) => (current + 1) % count);
    }, AUTO_SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [index, count, paused]);

  const arrowClass = "absolute top-1/2 z-10 hidden size-14 -translate-y-1/2 place-items-center text-white/85 transition-colors hover:text-white md:grid";

  return (
    <section
      aria-roledescription="carousel"
      aria-label="추천 굿즈"
      className="relative overflow-hidden"
      style={{ backgroundColor: BASE_COLOR }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <ul
        className="flex transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {products.map((product, i) => {
          const active = i === index;
          const color = themeColors[product.artist.slug] ?? "var(--brand)";
          return (
            <li
              key={product.id}
              className="w-full shrink-0 [--edge:10%] md:[--edge:22%] xl:[--edge:28%]"
              style={slideBackground(color)}
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count}`}
              aria-hidden={!active}
              inert={!active}
            >
              <div className="content-shell pt-6 pb-14 md:py-8">
                <Link href={`/products/${product.id}`} className="group grid items-center gap-5 md:grid-cols-2 md:gap-10 md:px-16">
                  <div className="relative aspect-2/1 overflow-hidden rounded-lg bg-white/10">
                    {product.thumbnailUrl ? (
                      <Image
                        src={product.thumbnailUrl}
                        alt={`${product.artist.name} ${product.name}`}
                        fill
                        sizes="(min-width: 768px) 40vw, 100vw"
                        loading={i === 0 ? "eager" : "lazy"}
                        fetchPriority={i === 0 ? "high" : "auto"}
                        className="object-contain transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div role="img" aria-label={`${product.name} 이미지 준비 중`} className="grid size-full place-items-center text-xs font-semibold text-white/70">
                        이미지 준비 중
                      </div>
                    )}
                  </div>
                  <div className="text-white">
                    <p className="text-sm font-bold opacity-80">{product.artist.name}</p>
                    <h2 className="mt-1 text-2xl font-black leading-snug md:text-4xl">{product.name}</h2>
                    <p className="mt-2 text-sm opacity-80">
                      {product.category.name} · {formatPrice(product.price)}
                    </p>
                  </div>
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      {count > 1 && (
        <div className="content-shell pointer-events-none absolute inset-0">
          <button type="button" aria-label="이전 배너" onClick={() => move(-1)} className={`${arrowClass} pointer-events-auto -left-2`}>
            <Chevron direction="left" />
          </button>
          <button type="button" aria-label="다음 배너" onClick={() => move(1)} className={`${arrowClass} pointer-events-auto -right-2`}>
            <Chevron direction="right" />
          </button>

          <div className="pointer-events-auto absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 md:bottom-6 md:left-[calc(50%+2.5rem)] md:translate-x-0">
            <button type="button" aria-label="이전 배너" onClick={() => move(-1)} className="grid size-9 place-items-center text-white md:hidden">
              <Chevron direction="left" />
            </button>
            <div className="flex items-center">
              {products.map((product, i) => (
                <button
                  key={product.id}
                  type="button"
                  aria-label={`${i + 1}번째 배너: ${product.name}`}
                  aria-current={i === index ? "true" : undefined}
                  onClick={() => setIndex(i)}
                  className="group/mark grid h-6 place-items-center px-1"
                >
                  <span className={`block h-1 rounded-full transition-all duration-300 ${i === index ? "w-6 bg-white" : "w-3 bg-white/40 group-hover/mark:bg-white/70"}`} />
                </button>
              ))}
            </div>
            <p className="rounded-full bg-black/30 px-2.5 py-0.5 text-xs tabular-nums" aria-live={paused ? "polite" : "off"}>
              <span className="font-bold text-white">{pad(index + 1)}</span>
              <span className="mx-1 text-white/50" aria-hidden="true">|</span>
              <span className="text-white/70">{pad(count)}</span>
            </p>
            <button type="button" aria-label="다음 배너" onClick={() => move(1)} className="grid size-9 place-items-center text-white md:hidden">
              <Chevron direction="right" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
