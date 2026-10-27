"use client";

import { useEffect } from "react";
import { FriendlyError } from "@/components/layout/FriendlyError";
import { reportClientError } from "@/lib/reportError";
import "./globals.css";

// 루트 레이아웃까지 실패했을 때의 마지막 안내. 이때는 레이아웃이 없으므로 html·body를 직접 둔다.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error, "global");
  }, [error]);

  return (
    <html lang="ko">
      <body>
        <main id="main-content">
          <FriendlyError onRetry={reset} />
        </main>
      </body>
    </html>
  );
}
