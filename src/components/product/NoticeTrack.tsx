"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { useSwipe } from "./useSwipe";

const SETTLE_MS = 500;

// 아티스트 Notice 목록: lg 미만은 가로로 넘기는 카드 한 줄 + 점 표시 (위버스샵 모바일 참고), lg 이상은 세로 목록.
// 손가락은 브라우저 기본 스크롤, 마우스는 끌어서 넘기기, 점을 눌러도 이동.
// relative: 카드 안 sr-only(절대 위치) 텍스트가 가로 스크롤 밖으로 새어 페이지 폭을 늘리지 않게
export function NoticeTrack({ count, children }: { count: number; children: ReactNode }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const [settling, setSettling] = useState(false); // 이동 애니메이션 중에는 스냅을 꺼 둔다
  const dragStart = useRef(0);

  function scrollToCard(index: number) {
    const track = trackRef.current;
    const cards = track?.children;
    if (!track || !cards?.length) return;
    const target = cards[Math.min(Math.max(index, 0), cards.length - 1)] as HTMLElement;
    setSettling(true);
    track.scrollTo({ left: target.offsetLeft - (cards[0] as HTMLElement).offsetLeft, behavior: "smooth" });
  }

  const { dragX, dragging, handlers } = useSwipe({
    enabled: count > 1,
    mouseOnly: true,
    onSwipe: (step) => scrollToCard(active + step),
    onCancel: () => scrollToCard(active),
  });

  useEffect(() => {
    if (dragging && trackRef.current) trackRef.current.scrollLeft = dragStart.current - dragX;
  }, [dragging, dragX]);

  useEffect(() => {
    if (!settling) return;
    const timer = window.setTimeout(() => setSettling(false), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [settling]);

  function handleScroll() {
    const track = trackRef.current;
    const first = track?.firstElementChild as HTMLElement | null;
    if (!track || !first || dragging) return;
    // 끝까지 밀면 마지막 카드가 다 보이지 않아도 마지막 점으로
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    setActive(atEnd ? count - 1 : Math.round(track.scrollLeft / first.offsetWidth));
  }

  function handlePointerDown(event: PointerEvent<HTMLUListElement>) {
    const track = event.currentTarget;
    if (track.scrollWidth <= track.clientWidth) return; // PC 세로 목록에서는 끌기 없음
    dragStart.current = track.scrollLeft;
    handlers.onPointerDown(event);
  }

  return (
    <>
      <ul
        ref={trackRef}
        onScroll={handleScroll}
        {...handlers}
        onPointerDown={handlePointerDown}
        className={`relative -mx-4 mt-4 flex gap-3 overflow-x-auto scroll-px-4 px-4 select-none scrollbar-none md:-mx-6 md:scroll-px-6 md:px-6 lg:mx-0 lg:block lg:space-y-3 lg:overflow-visible lg:px-0 lg:select-auto [&>li]:w-[85%] [&>li]:shrink-0 [&>li]:snap-start sm:[&>li]:w-[60%] lg:[&>li]:w-auto ${dragging ? "cursor-grabbing" : settling ? "" : "snap-x snap-mandatory"}`}
      >
        {children}
      </ul>
      {count > 1 && (
        <div className="mt-3 flex justify-center lg:hidden">
          {Array.from({ length: count }, (_, i) => (
            <button key={i} type="button" aria-label={`${i + 1}번째 공지 보기`} aria-current={i === active} onClick={() => scrollToCard(i)} className="grid size-5 place-items-center">
              <span className={`size-1.5 rounded-full ${i === active ? "bg-foreground" : "bg-line"}`} />
            </button>
          ))}
        </div>
      )}
    </>
  );
}
