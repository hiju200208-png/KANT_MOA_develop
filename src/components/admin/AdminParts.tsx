"use client";

import Link from "next/link";
import { Badge, Button } from "@/components/ui";
import { STATUS_LABELS, stockLevel } from "@/services/admin/adminForm";
import { AdminApiError, apiAssetUrl } from "@/services/admin/client";
import type { ProductStatus } from "@/types/admin";

// 401·403은 권한 안내, 나머지는 서버 메시지 + 다시 시도
export function AdminErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const status = error instanceof AdminApiError ? error.status : 0;
  const title =
    status === 401 ? "관리자 로그인이 필요해요." : status === 403 ? "관리자만 볼 수 있는 화면이에요." : "불러오지 못했어요.";
  const message = error instanceof AdminApiError ? error.message : "잠시 후 다시 시도해주세요.";
  return (
    <div role="alert" className="rounded-lg border border-red-100 bg-red-50 px-5 py-6 text-sm">
      <p className="font-bold text-danger">{title}</p>
      {status === 403 && <p className="mt-1 text-muted">관리자 계정으로 다시 로그인해주세요.</p>}
      {status !== 401 && status !== 403 && <p className="mt-1 text-muted">{message}</p>}
      <div className="mt-4 flex gap-2">
        {(status === 401 || status === 403) && (
          <Link href="/admin/login" className="text-sm font-bold underline">
            로그인하러 가기
          </Link>
        )}
        {onRetry && status !== 401 && status !== 403 && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            다시 시도
          </Button>
        )}
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<ProductStatus, string> = {
  on_sale: "bg-brand-soft text-brand-strong",
  sold_out: "bg-neutral-200 text-neutral-700",
  hidden: "bg-neutral-800 text-white",
};

export function StatusBadge({ status }: { status: ProductStatus }) {
  return <Badge className={STATUS_STYLE[status]}>{STATUS_LABELS[status]}</Badge>;
}

export function StockText({ total, isSoldOut }: { total: number; isSoldOut: boolean }) {
  const level = stockLevel(total, isSoldOut);
  const style = level === "out" ? "text-danger" : level === "low" ? "text-amber-600" : "text-foreground";
  return (
    <span className={`font-bold tabular-nums ${style}`}>
      {total.toLocaleString()}개{level === "out" ? " · 품절" : level === "low" ? " · 부족" : ""}
    </span>
  );
}

export function Thumb({ src, alt }: { src: string | null; alt: string }) {
  const url = apiAssetUrl(src);
  if (!url) return <span className="grid size-12 shrink-0 place-items-center rounded-md bg-neutral-100 text-xs text-muted">없음</span>;
  // 백엔드 정적 파일(/static, /uploads)이라 next/image 원격 설정 없이 일반 img로 표시
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="size-12 shrink-0 rounded-md bg-neutral-100 object-cover" loading="lazy" />;
}
