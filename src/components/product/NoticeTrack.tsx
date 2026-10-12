"use client";

import { useState, type ReactNode, type UIEvent } from "react";

// relative: 카드 안 sr-only(절대 위치) 텍스트가 가로 스크롤 밖으로 새어 페이지 폭을 늘리지 않게
// 아티스트 Notice 목록: lg 미만은 가로로 넘기는 카드 한 줄 + 점 표시 (위버스샵 모바일 참고), lg 이상은 세로 목록
export function NoticeTrack({ count, children }: { count: number; children: ReactNode }) {
  const [active, setActive] = useState(0);

  function handleScroll(event: UIEvent<HTMLUListElement>) {
    const track = event.currentTarget;
    const first = track.firstElementChild as HTMLElement | null;
    if (!first) return;
    // 끝까지 밀면 마지막 카드가 다 보이지 않아도 마지막 점으로
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    setActive(atEnd ? count - 1 : Math.round(track.scrollLeft / first.offsetWidth));
  }

  return (
    <>
      <ul
        onScroll={handleScroll}
        className="relative -mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 scrollbar-none md:-mx-6 md:scroll-px-6 md:px-6 lg:mx-0 lg:block lg:space-y-3 lg:overflow-visible lg:px-0 [&>li]:w-[85%] [&>li]:shrink-0 [&>li]:snap-start sm:[&>li]:w-[60%] lg:[&>li]:w-auto"
      >
        {children}
      </ul>
      {count > 1 && (
        <div aria-hidden="true" className="mt-4 flex justify-center gap-1.5 lg:hidden">
          {Array.from({ length: count }, (_, i) => (
            <span key={i} className={`size-1.5 rounded-full ${i === active ? "bg-foreground" : "bg-line"}`} />
          ))}
        </div>
      )}
    </>
  );
}
