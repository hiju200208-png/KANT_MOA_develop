"use client";

import { useRef, useState, type MouseEvent, type PointerEvent } from "react";

// 이만큼(px) 이상 밀면 다음/이전으로 넘기고, 클릭으로 보지 않음
const SWIPE_THRESHOLD = 50;
const DRAG_CLICK_TOLERANCE = 6;

interface UseSwipeOptions {
  enabled: boolean;
  onSwipe: (step: 1 | -1) => void;
}

// 마우스로 끌거나 손가락으로 밀어서 슬라이드를 넘기는 훅. 세로로 더 많이 움직이면 페이지 스크롤로 둔다.
export function useSwipe({ enabled, onSwipe }: UseSwipeOptions) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  const end = () => {
    if (dragging) {
      if (dragX <= -SWIPE_THRESHOLD) onSwipe(1);
      else if (dragX >= SWIPE_THRESHOLD) onSwipe(-1);
    }
    start.current = null;
    setDragging(false);
    setDragX(0);
  };

  const handlers = {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (!enabled || (event.pointerType === "mouse" && event.button !== 0)) return;
      start.current = { x: event.clientX, y: event.clientY };
      moved.current = false;
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const origin = start.current;
      if (!origin) return;
      // 버튼을 뗀 채로 들어온 마우스 이동은 끝난 것으로 처리 (영역 밖에서 버튼을 뗀 경우)
      if (event.pointerType === "mouse" && event.buttons === 0) return end();
      const dx = event.clientX - origin.x;
      if (!dragging) {
        if (Math.abs(dx) < DRAG_CLICK_TOLERANCE) return;
        if (Math.abs(event.clientY - origin.y) > Math.abs(dx)) {
          start.current = null;
          return;
        }
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      moved.current = true;
      setDragX(dx);
    },
    onPointerUp: end,
    onPointerCancel: end,
    onDragStart(event: MouseEvent<HTMLElement>) {
      event.preventDefault(); // 이미지가 따로 끌려 나오지 않게
    },
    onClickCapture(event: MouseEvent<HTMLElement>) {
      // 끌어서 넘긴 경우에는 링크로 이동하지 않음
      if (!moved.current) return;
      event.preventDefault();
      event.stopPropagation();
      moved.current = false;
    },
  };

  return { dragX, dragging, handlers };
}
