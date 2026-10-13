"use client";

import { useState } from "react";

// 상품 링크 공유. 휴대폰은 기기 공유 창(카카오톡·메시지 등), 컴퓨터는 링크 복사
export function ShareButton({ title }: { title: string }) {
  const [message, setMessage] = useState<string | null>(null);

  function notify(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 2000);
  }

  async function handleClick() {
    const url = window.location.href;
    // 휴대폰처럼 터치 화면이면 공유 창, 컴퓨터에서는 바로 링크 복사
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return; // 사용자가 공유 창을 닫음
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      notify("링크를 복사했어요");
    } catch {
      notify("링크를 복사하지 못했어요");
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        aria-label="상품 링크 공유"
        title="공유하기"
        className="grid size-10 place-items-center rounded-full border border-line bg-white transition-colors hover:border-neutral-400"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12" />
          <path d="m7 8 5-5 5 5" />
          <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
        </svg>
      </button>
      <p role="status" aria-live="polite" className={`absolute top-full right-0 z-10 mt-2 whitespace-nowrap rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white transition-opacity ${message ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        {message}
      </p>
    </div>
  );
}
