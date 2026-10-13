import type { ReactNode } from "react";

// 본문 영역. 레이아웃마다 헤더 유무만 다르고 본문 틀은 같아서 공용으로 둔다 (skip-link 대상 id 포함)
export function PageMain({ children }: { children: ReactNode }) {
  return (
    <main id="main-content" className="min-w-0 flex-1">
      {children}
    </main>
  );
}
