"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { TopBar } from "@/components/layout/TopBar";
import type { Artist, ProductSummary } from "@/types/app";
import { artistThemeStyle } from "@/components/artist/artistTheme";
import { formatPrice } from "@/components/product/formatPrice";
import { heroSubtitle } from "./heroCopy";
import { HERO_VIDEOS, type HeroVideo } from "./heroVideos";
import { useSwipe } from "@/components/product/useSwipe";

// 배너 글꼴(배너 전체): 위버스샵과 같은 Pretendard (오픈 폰트, OFL). 사이트 글꼴 목록에 이름은 있지만 불러오지는 않아서
// 배너에서 웹폰트(쓰인 글자만 내려받는 dynamic subset)를 불러온다. React 19가 <link>를 <head>로 올려 준다
const PRETENDARD_CSS = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";
const displayFont = "font-['Pretendard_Variable',Pretendard,sans-serif]";

// 배너에 오르는 이유: 영상(컴백) · 새로 나온 상품 · 판매 1위 상품
export type SpotlightKind = "COMEBACK" | "NEW" | "BEST";
// pick: 서버(page.tsx)에서 고른 대표 상품. 발매일이 최근 30일 안이거나 곧 발매되는 상품이 있으면 NEW, 없으면 최근 7일 판매 1위 BEST
export type SpotlightArtist = Pick<Artist, "id" | "slug" | "name" | "nameKo" | "tagline" | "themeColor"> & {
  pick?: { kind: "NEW" | "BEST"; product: ProductSummary };
};

const KIND_STYLE: Record<SpotlightKind, { label: string; color: string; reason: string }> = {
  COMEBACK: { label: "COMEBACK", color: "#d63a32", reason: "" },
  NEW: { label: "NEW", color: "#1f8a5f", reason: "최근 30일 안에 발매됐거나 곧 발매되는 신상품이에요." },
  BEST: { label: "BEST", color: "#b9821a", reason: "최근 7일 판매량 1위 상품이에요. 판매 기록이 없으면 최근 등록한 상품을 보여줘요." },
};

// 배너 오른쪽 위 기준 배지 (기준마다 색이 다름)
function KindBadge({ kind }: { kind: SpotlightKind }) {
  const { label, color } = KIND_STYLE[kind];
  return (
    <span style={{ backgroundColor: color }} className="absolute top-3 right-0 z-10 rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-white text-shadow-none shadow-[0_4px_12px_-4px_rgb(0_0_0/0.4)] md:top-5 md:text-xs">
      {label}
    </span>
  );
}

const AUTO_SLIDE_MS = 4000;
const VIDEO_MAX_WAIT_MS = 30000; // 영상이 멈추거나 끝 신호가 오지 않아도 배너가 멈춰 있지 않도록
const AFTER_VIDEO_MS = 1000; // 영상이 끝난 뒤 마지막 장면을 잠깐 보여주고 넘김
const SLIDE_MS = 700; // 슬라이드 넘김 애니메이션 길이 (아래 duration-700과 맞춤)

// 미니멀 배너: 아티스트 색 없이 톤다운된 무채색 단색 바탕
const BAND_COLOR = "#f2f2f0";
const bandStyle: CSSProperties = { backgroundColor: BAND_COLOR, backgroundImage: "none" };

// 영상 배너: 바탕은 영상 분위기 색(base), 영상 네 면을 같은 색으로 은은하게 녹이고 왼쪽 문구 뒤는 조금 더 어둡게
const videoBandStyle = (video: HeroVideo): CSSProperties => ({ backgroundColor: `rgb(${video.base})`, backgroundImage: "none" });
const videoEdgeFade = ({ base }: HeroVideo) =>
  [
    `linear-gradient(to right, rgb(${base}) 0%, rgb(${base} / 0) 12%)`,
    `linear-gradient(to left, rgb(${base}) 0%, rgb(${base} / 0) 12%)`,
    `linear-gradient(to bottom, rgb(${base} / 0.8) 0%, rgb(${base} / 0) 14%)`,
    `linear-gradient(to top, rgb(${base} / 0.8) 0%, rgb(${base} / 0) 14%)`,
  ].join(", ");
const videoTextShade = ({ base, ambient }: HeroVideo) =>
  ambient
    ? // 뮤비 색 배경은 밝고 화려해서, 문구와 헤더가 읽히도록 왼쪽·위쪽만 살짝 어둡게
      "linear-gradient(90deg, rgb(0 0 0 / 0.35) 0%, rgb(0 0 0 / 0) 45%), linear-gradient(to bottom, rgb(0 0 0 / 0.25) 0%, rgb(0 0 0 / 0) 22%)"
    : `linear-gradient(90deg, rgb(${base} / 0.5) 0%, rgb(${base} / 0) 40%)`;
// ambient 영상: 가장자리를 투명하게 만들어 뒤의 뮤비 색 배경에 녹인다
const AMBIENT_MASK = [
  "linear-gradient(to right, transparent 0%, #000 20%, #000 80%, transparent 100%)",
  "linear-gradient(to bottom, transparent 0%, #000 14%, #000 86%, transparent 100%)",
].join(", ");
const ambientMaskStyle: CSSProperties = {
  maskImage: AMBIENT_MASK,
  maskComposite: "intersect",
  WebkitMaskImage: AMBIENT_MASK,
  WebkitMaskComposite: "source-in",
};
const AMBIENT_FPS_MS = 120; // 배경 색을 영상 장면에 맞춰 다시 그리는 간격

function chipLabel(product: ProductSummary) {
  if (product.isLimited) return "한정";
  if (product.isPreorder) return "예약 판매";
  return product.category.name;
}

// 상품 상자 가장자리를 살짝 흐리게 해서 사진 테두리 선이 보이지 않게
const FEATHER_MASK = "linear-gradient(to right, transparent, #000 5%, #000 95%, transparent), linear-gradient(to bottom, transparent, #000 5%, #000 95%, transparent)";
const EDGE_FEATHER: CSSProperties = { maskImage: FEATHER_MASK, maskComposite: "intersect", WebkitMaskImage: FEATHER_MASK, WebkitMaskComposite: "source-in" };

// 사진 분석 결과: 배경을 흰색으로 올릴 밝기 배율 + 상품이 상자에 꽉 차되 잘리지 않게 할 확대·이동 값
type ImageFit = { lift: number; scale: number; x: number; y: number }; // x·y: 상자 크기 대비 이동(%)
const NO_FIT: ImageFit = { lift: 1, scale: 1, x: 0, y: 0 };
const FIT_GRID = 48; // 이 크기로 줄여서 픽셀을 읽는다
const FIT_FILL = 0.88; // 상품이 상자에서 차지할 최대 비율 (가장자리 흐림 영역에 닿지 않도록)
const FIT_MAX_SCALE = 1.6;

// 상품 사진(흰색~연회색 단색 배경)을 읽어 배경 밝기와 상품이 있는 영역(배경과 다른 픽셀)을 구한다.
// 아직 그려지지 않아 읽을 수 없으면 null
function analyzeImage(image: HTMLImageElement): ImageFit | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = FIT_GRID;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return NO_FIT;
    context.drawImage(image, 0, 0, FIT_GRID, FIT_GRID);
    const { data } = context.getImageData(0, 0, FIT_GRID, FIT_GRID);
    const [br, bg, bb, ba] = data; // 왼쪽 위 모서리 = 배경
    if (ba === 0) return null;
    const level = Math.min(br, bg, bb);
    const lift = level > 200 ? Math.min((255 / level) * 1.02, 1.14) : 1; // 가장자리 오차까지 덮도록 2% 더

    let minX = FIT_GRID, minY = FIT_GRID, maxX = -1, maxY = -1;
    for (let y = 0; y < FIT_GRID; y++) {
      for (let x = 0; x < FIT_GRID; x++) {
        const i = (y * FIT_GRID + x) * 4;
        const diff = Math.max(Math.abs(data[i] - br), Math.abs(data[i + 1] - bg), Math.abs(data[i + 2] - bb));
        if (diff > 14) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
    }
    if (maxX < 0) return { ...NO_FIT, lift };
    const width = (maxX - minX + 1) / FIT_GRID;
    const height = (maxY - minY + 1) / FIT_GRID;
    const scale = Math.min(Math.max(FIT_FILL / Math.max(width, height), 1), FIT_MAX_SCALE);
    // 상품 중심을 상자 가운데로 (확대 후 위치 기준)
    const centerX = (minX + maxX + 1) / 2 / FIT_GRID - 0.5;
    const centerY = (minY + maxY + 1) / 2 / FIT_GRID - 0.5;
    return { lift, scale, x: -centerX * scale * 100, y: -centerY * scale * 100 };
  } catch {
    return { ...NO_FIT, lift: 1.09 }; // 픽셀을 읽을 수 없으면 연회색 배경 기준값, 확대 없음
  }
}

// 대표 상품 하나를 크게, 배경 없이(누끼처럼): 배경을 흰색으로 올린 뒤 배너 바탕과 곱하기(multiply)로 합성하면 사진 배경이 사라진다.
// 슬라이드가 보일 때 아래에서 살짝 기울어진 채 떠오르고, 이후 천천히 위아래로 떠 있는다
function HeroProduct({ product, kind, active }: { product: ProductSummary; kind: SpotlightKind; active: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState<ImageFit>(NO_FIT);
  // 이미지가 React 준비 전에 이미 로드됐으면 onLoad가 오지 않으므로, 연결되는 시점에도 한 번 계산한다
  const imageRef = useRef<HTMLImageElement | null>(null);
  // 바로 읽히면 바로, 아직 그려지지 않았으면 decode()가 끝난 뒤에 잰다
  const measure = useCallback((image: HTMLImageElement | null) => {
    imageRef.current = image;
    if (!image?.complete || image.naturalWidth === 0) return;
    const value = analyzeImage(image);
    if (value !== null) return setFit(value);
    const retry = () => setFit(analyzeImage(image) ?? NO_FIT);
    image.decode().then(retry, retry);
  }, []);

  // 이미지 로드 신호가 늦거나 오지 않는 경우(지연 로딩·백그라운드 탭)를 대비해, 슬라이드가 보이면 읽힐 때까지 다시 잰다
  useEffect(() => {
    if (!active) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      const image = imageRef.current;
      const value = image?.complete && image.naturalWidth > 0 ? analyzeImage(image) : null;
      if (value !== null) setFit(value);
      if (value !== null || ++tries >= 20) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [active]);

  useEffect(() => {
    const element = ref.current;
    if (!element || !active || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let float: Animation | undefined;
    const enter = element.animate(
      [
        { opacity: 0, transform: "translateY(36px) scale(0.92) rotate(-4deg)" },
        { opacity: 1, transform: "translateY(0) scale(1) rotate(0deg)" },
      ],
      { duration: 1000, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
    enter.onfinish = () => {
      float = element.animate([{ transform: "translateY(0)" }, { transform: "translateY(-12px)" }], {
        duration: 3200,
        direction: "alternate",
        iterations: Infinity,
        easing: "ease-in-out",
      });
    };
    return () => {
      enter.cancel();
      float?.cancel();
    };
  }, [active]);

  return (
    <Link href={`/products/${product.id}`} draggable={false} className="group relative mx-auto block w-full max-w-[280px] md:mx-0 md:max-w-[440px]">
      {/* 움직이는 상자는 배너와 같은 색을 깔아야 곱하기 합성이 배너 바탕 기준으로 된다 (보이지 않음) */}
      <span ref={ref} className="relative block aspect-square" style={{ backgroundColor: BAND_COLOR }}>
        {product.thumbnailUrl && (
          // 합성(multiply)은 감싼 상자에, 밝기 필터는 이미지에 따로 건다 (한 요소에 같이 걸면 Chrome이 합성을 무시함)
          <span className="absolute inset-0 overflow-hidden mix-blend-multiply transition-transform duration-700 group-hover:scale-[1.04] motion-reduce:transition-none" style={EDGE_FEATHER}>
            <Image
              src={product.thumbnailUrl}
              alt={`${product.artist.name} ${product.name}`}
              fill
              sizes="(min-width: 768px) 440px, 280px"
              priority={active}
              ref={measure}
              onLoad={(event) => measure(event.currentTarget)}
              // 사진마다 상품 영역을 재서 상자를 꽉 채우되 잘리지 않게 확대·이동 (분석 전에는 원래 크기)
              style={{ filter: `brightness(${fit.lift})`, transform: `translate(${fit.x}%, ${fit.y}%) scale(${fit.scale})` }}
              className="object-contain transition-transform duration-500 motion-reduce:transition-none"
            />
          </span>
        )}
      </span>
      {/* 바닥 그림자: 상품이 떠 있는 느낌 */}
      <span aria-hidden="true" className="mx-auto -mt-4 block h-3 w-1/2 rounded-[50%] bg-black/10 blur-md" />
      {/* 모바일은 옆 설명 대신 이미지 아래 한 줄 */}
      <span className="mt-2 block text-center text-xs text-neutral-500 md:hidden">
        <span className="font-semibold" style={{ color: KIND_STYLE[kind].color }}>{KIND_STYLE[kind].label}</span> · <span className="font-medium text-neutral-900">{product.name}</span> ·{" "}
        <span className="tabular-nums">{formatPrice(product.price)}</span>
      </span>
    </Link>
  );
}

function Slide({ artist, active, video }: { artist: SpotlightArtist; active: boolean; video?: HeroVideo }) {
  // 영상 슬라이드는 COMEBACK(영상을 가리지 않도록 상품은 띄우지 않음), 나머지는 서버에서 고른 NEW·BEST 상품
  const product = video ? undefined : artist.pick?.product;
  const kind: SpotlightKind | undefined = video ? "COMEBACK" : artist.pick?.kind;
  return (
    <li aria-roledescription="slide" aria-label={artist.name} aria-hidden={!active} inert={!active} style={artistThemeStyle(artist.themeColor)} className="w-full shrink-0">
      <div className="content-shell relative">
        {kind && <KindBadge kind={kind} />}
        <div className="grid items-center gap-4 pt-4 pb-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-6 md:pt-2 md:pb-6">
          <div className={`flex flex-col gap-3 md:gap-4 ${video ? "text-white text-shadow-[0_1px_10px_rgb(0_0_0/0.5)]" : ""}`}>
            <span style={video ? { color: video.accent } : undefined} className={`text-[11px] font-semibold tracking-[0.22em] md:text-xs ${video ? "" : "text-neutral-500"}`}>
              {artist.name} · OFFICIAL GOODS
            </span>
            <h2
              style={video?.titleColor ? { color: video.titleColor } : undefined}
              className={`text-[26px] leading-[1.25] font-bold tracking-[-0.03em] break-keep md:text-[44px] ${video ? "" : "text-neutral-900"}`}
            >
              {video?.title ?? artist.tagline ?? `${artist.nameKo} 공식 굿즈`}
            </h2>
            <p className={`text-sm font-medium md:text-base ${video ? "max-w-md leading-relaxed break-keep text-white/90" : "text-neutral-600"}`}>
              {video?.description ?? heroSubtitle(artist.name, product)}
            </p>
            {product && (
              // 대표 상품 설명: 가는 선 아래 NEW·BEST · 카테고리 · 상품명 · 가격 · 상품 보기 + 선정 기준
              <div className="mt-2 hidden max-w-sm border-t border-neutral-300 pt-4 md:block">
                <p className="text-[11px] tracking-[0.18em] text-neutral-500">
                  <span className="font-bold" style={{ color: kind ? KIND_STYLE[kind].color : undefined }}>{kind === "BEST" ? "BEST 1" : kind}</span> · {chipLabel(product)}
                </p>
                <p className={`mt-1.5 line-clamp-2 text-base font-semibold break-keep text-neutral-900 md:text-lg`}>{product.name}</p>
                <p className="mt-1 text-sm font-medium text-neutral-600 tabular-nums">{formatPrice(product.price)}</p>
                <Link href={`/products/${product.id}`} draggable={false} className="mt-4 inline-flex items-center gap-2 border-b border-neutral-900 pb-0.5 text-sm font-semibold text-neutral-900 transition-[gap] duration-200 hover:gap-3">
                  상품 보기 <span aria-hidden="true">→</span>
                </Link>
                {/* 배너 상품 선정 기준 (page.tsx MainHero) */}
                {kind && <p className="mt-4 text-[11px] leading-4 text-neutral-400">{KIND_STYLE[kind].reason}</p>}
              </div>
            )}
            {video && (
              <Link
                href={`/artists/${artist.slug}?category=album`}
                draggable={false}
                // 전역 a { color: inherit }가 바깥 글자색을 물려받지 않도록 색을 직접 지정
                style={video.cta}
                className="mt-3 inline-flex h-12 items-center gap-1.5 self-start rounded-full px-6 text-[15px] font-extrabold text-shadow-none shadow-[0_8px_24px_-8px_rgb(0_0_0/0.5)] transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:transition-none"
              >
                앨범 보러가기 <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>

          {product && kind && <HeroProduct product={product} kind={kind} active={active} />}
        </div>

      </div>
    </li>
  );
}

// 배너 전체(헤더 포함) 뒤에 깔리는 영상. 세로를 꽉 채우고 가로는 16:9 비율로 가운데 정렬
function VideoBackdrop({
  video: config,
  active,
  playing,
  onStart,
  onEnded,
  onBlocked,
  onError,
}: {
  video: HeroVideo;
  active: boolean;
  playing: boolean;
  onStart: () => void;
  onEnded: () => void;
  onBlocked: () => void;
  onError: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const ambientRef = useRef<HTMLCanvasElement>(null);

  // ambient: 재생 중인 장면을 아주 작은 캔버스에 계속 옮겨 그리고, 그 캔버스를 크게 늘려 흐리게 깔면 뮤비 색 그라데이션이 된다
  useEffect(() => {
    const video = ref.current;
    const canvas = ambientRef.current;
    const context = canvas?.getContext("2d");
    if (!config.ambient || !active || !video || !canvas || !context) return;
    const draw = () => {
      if (video.readyState >= 2) context.drawImage(video, 0, 0, canvas.width, canvas.height);
    };
    draw();
    video.addEventListener("loadeddata", draw);
    video.addEventListener("seeked", draw);
    const timer = window.setInterval(draw, AMBIENT_FPS_MS);
    return () => {
      window.clearInterval(timer);
      video.removeEventListener("loadeddata", draw);
      video.removeEventListener("seeked", draw);
    };
  }, [active, config.ambient]);

  // 이 슬라이드가 보일 때만 처음부터 재생하고, 넘어가면 멈춘다.
  // 페이지를 열자마자 첫 슬라이드에서 재생하면 브라우저가 막거나(자동재생 정책) 백그라운드 탭이라 멈출 수 있어서
  // - 소리 끔을 재생 직전에 다시 확실히 하고
  // - 탭이 다시 보이면 이어서 재생하고
  // - 그래도 막히면 건너뛰지 않고 첫 장면을 보통 슬라이드처럼 4초 보여준다
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (!active || !playing) {
      video.pause();
      return;
    }
    onStart(); // 다시 돌아왔을 때 이전에 끝난·막힌 기록을 지운다
    video.muted = true;
    video.currentTime = 0;
    const play = () => {
      video.muted = true;
      video.play().catch((error: DOMException) => {
        if (error.name === "NotAllowedError") onBlocked(); // AbortError(넘기면서 멈춤)는 무시
      });
    };
    play();
    const resume = () => {
      if (!document.hidden && video.paused && !video.ended) play();
    };
    document.addEventListener("visibilitychange", resume);
    return () => document.removeEventListener("visibilitychange", resume);
  }, [active, playing]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 flex justify-center overflow-hidden transition-opacity duration-700 motion-reduce:transition-none ${active ? "opacity-100" : "opacity-0"}`}>
      {config.ambient && <canvas ref={ambientRef} width={32} height={18} className="absolute inset-0 size-full scale-125 blur-[56px] saturate-150" />}
      <div className="relative aspect-video h-full flex-none" style={config.ambient ? ambientMaskStyle : undefined}>
        <video ref={ref} src={config.src} muted playsInline preload="metadata" onEnded={onEnded} onError={onError} className="absolute inset-0 size-full object-cover" />
        {!config.ambient && <div className="absolute inset-0" style={{ background: videoEdgeFade(config) }} />}
      </div>
      <div className="absolute inset-0" style={{ background: videoTextShade(config) }} />
    </div>
  );
}

// 메인 배너 (시안 C · 파스텔 스포트라이트) 슬라이드: 아티스트마다 한 장 (문구 + 겹친 인기 상품 3개).
// 4초마다 자동으로 넘어가고, 마우스로 끌거나 손가락으로 밀어서·위 버튼으로 넘김. 배경 톤도 아티스트 색으로 바뀜
export function HomeSpotlight({ artists: allArtists }: { artists: SpotlightArtist[] }) {
  // 순서: COMEBACK 영상(heroVideos.ts 순서)과 NEW·BEST 상품 슬라이드를 번갈아 → 영상, 상품, 영상, 상품 … 남는 건 뒤에
  const videoArtists = Object.keys(HERO_VIDEOS).flatMap((slug) => allArtists.filter((artist) => artist.slug === slug));
  const productArtists = allArtists.filter((artist) => !(artist.slug in HERO_VIDEOS));
  const artists = Array.from({ length: Math.max(videoArtists.length, productArtists.length) }, (_, i) => [videoArtists[i], productArtists[i]])
    .flat()
    .filter((artist): artist is SpotlightArtist => artist !== undefined);
  const count = artists.length;
  const loop = count > 1;
  // 무한 루프: 앞에 마지막 복제, 뒤에 첫 번째 복제를 붙여 [마지막', 1..N, 1'] 로 그림.
  // 복제 칸에 도착하면 애니메이션 없이 진짜 칸으로 순간 이동해서, 마지막 → 1번이 한 칸만 넘어가는 것처럼 보임
  const slides = loop ? [artists[count - 1], ...artists, artists[0]] : artists;
  const [pos, setPos] = useState(loop ? 1 : 0);
  const [instant, setInstant] = useState(false); // 복제 칸 → 진짜 칸 순간 이동 중
  const [paused, setPaused] = useState(false);
  const index = loop ? (pos - 1 + count) % count : 0;
  const move = (step: number) => setPos((current) => Math.min(Math.max(current + step, 0), count + 1));
  const { dragX, dragging, handlers } = useSwipe({ enabled: loop, onSwipe: move });
  const [failedVideos, setFailedVideos] = useState<string[]>([]);
  const [endedPos, setEndedPos] = useState<number | null>(null); // 영상이 끝까지 재생된 슬라이드 위치
  const [blockedPos, setBlockedPos] = useState<number | null>(null); // 브라우저가 자동재생을 막은 슬라이드 위치
  const [reducedMotion, setReducedMotion] = useState(false);
  const videoOf = (item: SpotlightArtist | undefined) => (item && !failedVideos.includes(item.slug) ? HERO_VIDEOS[item.slug] : undefined);
  const artist = artists[index];
  const activeVideo = videoOf(artist);
  const videoActive = Boolean(activeVideo);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // 영상 슬라이드는 4초 대신 영상이 끝나면 넘어간다 (동작 줄이기 설정이면 영상을 재생하지 않으므로 4초)
  const playingVideo = videoActive && !reducedMotion;
  const videoEnded = endedPos === pos;
  const videoBlocked = blockedPos === pos;
  const autoSlideMs = !playingVideo || videoBlocked ? AUTO_SLIDE_MS : videoEnded ? AFTER_VIDEO_MS : VIDEO_MAX_WAIT_MS;
  useEffect(() => {
    if (!loop || paused || dragging) return;
    const timer = window.setTimeout(() => {
      if (!document.hidden) move(1);
    }, autoSlideMs);
    return () => window.clearTimeout(timer);
  }, [pos, loop, paused, dragging, autoSlideMs]); // eslint-disable-line react-hooks/exhaustive-deps

  // 순간 이동이 그려진 다음 프레임에 다시 애니메이션 켜기
  useEffect(() => {
    if (!instant) return;
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setInstant(false)));
    return () => cancelAnimationFrame(frame);
  }, [instant]);

  // 복제 칸에 도착하면 넘어가는 애니메이션(700ms)이 끝난 뒤 진짜 칸으로 순간 이동.
  // transitionend 대신 타이머: 모션 줄이기 설정이라 애니메이션이 없어도 멈추지 않게
  useEffect(() => {
    if (!loop || dragging || (pos !== 0 && pos !== count + 1)) return;
    const timer = window.setTimeout(() => {
      setInstant(true);
      setPos(pos === 0 ? count : 1);
    }, SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [pos, loop, count, dragging]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="메인 배너"
      style={{ ...artistThemeStyle(artist?.themeColor ?? null), ...(activeVideo ? videoBandStyle(activeVideo) : bandStyle) }}
      className={`relative transition-[background-color] duration-700 ${displayFont}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {artists.map((item, i) => {
        const video = videoOf(item);
        return video ? (
          <VideoBackdrop
            key={item.id}
            video={video}
            active={i === index}
            playing={!reducedMotion}
            onStart={() => {
              setEndedPos(null);
              setBlockedPos(null);
            }}
            onEnded={() => setEndedPos(pos)}
            onBlocked={() => setBlockedPos(pos)}
            onError={() => setFailedVideos((list) => [...list, item.slug])}
          />
        ) : null;
      })}

      <link rel="stylesheet" href={PRETENDARD_CSS} precedence="default" />

      {/* 영상 위에서는 헤더 로고·아이콘·로그인 버튼을 흰색으로. 모바일 메뉴(흰 패널 dialog)는 원래 색 유지 */}
      <div className={`relative ${videoActive ? "text-white [&_.border-line]:border-white/45 [&_.border-line]:bg-white/10 [&_.border-line]:backdrop-blur-sm [&_a]:text-white [&_button]:text-white [&_img]:brightness-0 [&_img]:invert [&_dialog]:text-foreground [&_dialog_a]:text-foreground [&_dialog_button]:text-foreground [&_dialog_.border-line]:border-line [&_dialog_.border-line]:bg-transparent [&_dialog_.border-line]:backdrop-blur-none" : ""}`}>
        <TopBar showBack={false} />
      </div>

      <div className="relative overflow-hidden">
        <ul
          className={`flex touch-pan-y select-none ${dragging ? "cursor-grabbing" : instant ? "" : "transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"}`}
          style={{ transform: `translateX(calc(-${pos * 100}% + ${dragX}px))` }}
          {...handlers}
        >
          {slides.map((item, i) => (
            <Slide key={`${i}-${item.id}`} artist={item} active={i === pos} video={videoOf(item)} />
          ))}
        </ul>
      </div>

      {count > 1 && (
        // 진행 막대: 어두운 막대 위 흰 구간이 현재 배너 위치. 구간마다 투명 버튼이 겹쳐 있어 눌러서 이동
        <div className="content-shell relative pb-6 md:pb-8">
          <div className={`relative mx-auto h-0.5 w-40 md:w-60 ${videoActive ? "bg-white/30" : "bg-neutral-300"}`} role="group" aria-label="배너 선택">
            <span
              aria-hidden="true"
              className={`absolute inset-y-0 left-0 transition-transform duration-700 ${videoActive ? "bg-white" : "bg-neutral-900"} ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none`}
              style={{ width: `${100 / count}%`, transform: `translateX(${index * 100}%)` }}
            />
            <div className="absolute inset-x-0 -inset-y-2 flex">
              {artists.map((item, i) => (
                <button key={item.id} type="button" aria-label={item.name} aria-current={i === index} onClick={() => setPos(i + 1)} className="h-full flex-1" />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
