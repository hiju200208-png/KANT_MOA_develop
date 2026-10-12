"use client";

import { usePathname } from "next/navigation";
import { TopBar } from "./TopBar";

// 메인은 배너 안에 같은 TopBar가 있으므로 루트 경로에서만 전역 헤더를 숨깁니다.
export function Header() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur-lg">
      <TopBar />
    </header>
  );
}
