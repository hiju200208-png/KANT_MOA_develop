"use client";

import { StatusView } from "@/components/feedback/StatusView";

export function FriendlyError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="content-shell min-h-[60vh] py-10 md:py-16">
      <StatusView variant="server-error" actions={onRetry ? [{ label: "다시 시도", onClick: onRetry }, { label: "홈으로", href: "/" }] : undefined} />
    </div>
  );
}
