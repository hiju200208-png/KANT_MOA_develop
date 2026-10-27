"use client";

import { useEffect } from "react";
import { FriendlyError } from "@/components/layout/FriendlyError";
import { reportClientError } from "@/lib/reportError";

// 화면(페이지) 렌더 중 오류: 고객에게는 친절한 안내, 오류 내용은 개발자에게만 (/api/client-errors → 서버 로그)
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error, "page");
  }, [error]);

  return <FriendlyError onRetry={reset} />;
}
