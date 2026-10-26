"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button, Card, Skeleton } from "@/components/ui";
import { formatPrice } from "@/lib/formatPrice";
import { IMAGE_TYPES, STATUS_LABELS, STATUS_OPTIONS, checkImageFile, parseStockChange, previewStock } from "@/services/admin/adminForm";
import { adjustStock, changeProductStatus, getAdminProduct, uploadProductThumbnail } from "@/services/admin/api";
import { adminErrorMessage } from "@/services/admin/client";
import type { AdminProductDetail, AdminVariant, ProductStatus } from "@/types/admin";
import { AdminErrorBox, StatusBadge, StockText, Thumb } from "./AdminParts";

// 관리자 상품 상세: 판매 상태 변경 + 옵션별 재고 증감
export function AdminProductDetailView() {
  const params = useParams<{ id: string }>();
  const productId = Number(params.id);
  const validId = Number.isInteger(productId) && productId > 0;
  const [product, setProduct] = useState<AdminProductDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setProduct(await getAdminProduct(productId));
    } catch (e) {
      setError(e);
    }
  }, [productId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 화면에 들어오면 서버에서 상세를 받는다
    if (validId) void load();
  }, [validId, load]);

  async function handleStatus(status: ProductStatus) {
    if (!product || status === product.status) return;
    setSavingStatus(true);
    setMessage(null);
    try {
      setProduct(await changeProductStatus(product.id, status));
      setMessage(`판매 상태를 ${STATUS_LABELS[status]}(으)로 바꿨어요.`);
    } catch (e) {
      setMessage(adminErrorMessage(e));
    } finally {
      setSavingStatus(false);
    }
  }

  // 대표 이미지 교체 (#39): 새 파일명으로 저장되고 thumbnail_url이 /uploads/... 로 바뀐다
  async function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !product) return;
    const problem = checkImageFile(file);
    if (problem) return setMessage(problem);
    setUploading(true);
    setMessage(null);
    try {
      setProduct(await uploadProductThumbnail(product.id, file));
      setMessage("대표 이미지를 바꿨어요.");
    } catch (e) {
      setMessage(adminErrorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  // 재고 조정 성공 시 해당 옵션 재고만 바꾸고, 품절 여부는 서버 상세를 다시 받아 맞춘다
  async function handleAdjusted(variantId: number, after: number) {
    setProduct((prev) => prev && { ...prev, variants: prev.variants.map((v) => (v.id === variantId ? { ...v, stock: after } : v)) });
    await load();
  }

  if (!validId) return <AdminErrorBox error={null} />;
  if (error) return <AdminErrorBox error={error} onRetry={load} />;
  if (!product) return <Skeleton className="h-80 w-full" />;

  const total = product.variants.reduce((sum, v) => sum + v.stock, 0);

  return (
    <section className="space-y-6">
      <Link href="/admin/products" className="text-sm text-muted hover:underline">← 상품 목록</Link>

      <Card className="flex flex-wrap items-center gap-4 p-5">
        <div className="flex flex-col items-center gap-1">
          <Thumb src={product.thumbnail_url} alt={`${product.name} 대표 이미지`} />
          <input ref={fileInput} type="file" accept={IMAGE_TYPES.join(",")} className="hidden" onChange={handleImage} aria-label="대표 이미지 파일 선택" />
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" loading={uploading} onClick={() => fileInput.current?.click()}>
            이미지 변경
          </Button>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">{product.artist.name} · {product.category?.name ?? "분류 없음"} · #{product.id}</p>
          <h1 className="text-xl font-black">{product.name}</h1>
          <p className="mt-1 text-sm">
            {formatPrice(product.price)} · 총재고 <StockText total={total} isSoldOut={product.is_sold_out} />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={product.status} />
          <select
            aria-label="판매 상태 변경"
            className="h-10 rounded-md border border-line bg-white px-3 text-sm"
            value={product.status}
            disabled={savingStatus}
            onChange={(e) => handleStatus(e.target.value as ProductStatus)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        {product.status === "on_sale" && product.is_sold_out && (
          <p className="w-full text-xs text-amber-700">판매중이지만 재고가 0이라 손님 화면에는 품절로 보여요.</p>
        )}
      </Card>

      {message && <p role="status" className="rounded-md bg-neutral-100 px-4 py-2 text-sm">{message}</p>}

      <div>
        <h2 className="mb-3 text-lg font-black">옵션별 재고</h2>
        <p className="mb-3 text-xs text-muted">재고는 &lsquo;몇 개로&rsquo;가 아니라 &lsquo;몇 개 늘리거나(+) 줄이기(-)&rsquo;로 바꿔요. 주문과 동시에 바뀌어도 수량이 사라지지 않아요.</p>
        <div className="space-y-3">
          {product.variants.map((variant) => (
            <VariantStockRow key={variant.id} productId={product.id} variant={variant} onAdjusted={handleAdjusted} />
          ))}
          {product.variants.length === 0 && <p className="text-sm text-muted">등록된 옵션이 없어요.</p>}
        </div>
      </div>
    </section>
  );
}

function VariantStockRow({
  productId,
  variant,
  onAdjusted,
}: {
  productId: number;
  variant: AdminVariant;
  onAdjusted: (variantId: number, after: number) => Promise<void>;
}) {
  const [change, setChange] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parsed = change.trim() ? parseStockChange(change) : null;
  const preview = parsed && "value" in parsed ? previewStock(variant.stock, parsed.value) : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = parseStockChange(change);
    if ("error" in result) return setError(result.error);
    if (!previewStock(variant.stock, result.value).ok) return setError("재고는 0개보다 적을 수 없어요.");
    setSaving(true);
    setError(null);
    setDone(null);
    try {
      const res = await adjustStock(productId, variant.id, result.value, reason);
      setDone(`${res.before}개 → ${res.after}개`);
      setChange("");
      setReason("");
      await onAdjusted(variant.id, res.after);
    } catch (e) {
      setError(adminErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-4">
      <div className="min-w-40 flex-1">
        <p className="font-bold">{variant.option_name}</p>
        <p className="text-xs text-muted">
          현재 <b className="tabular-nums text-foreground">{variant.stock}</b>개
          {variant.extra_price > 0 && ` · 추가금 ${formatPrice(variant.extra_price)}`}
          {variant.max_per_user && ` · 1인 ${variant.max_per_user}개`}
        </p>
      </div>
      <label className="text-xs font-bold">
        증감
        <input
          value={change}
          onChange={(e) => setChange(e.target.value)}
          inputMode="numeric"
          placeholder="+10 / -3"
          className="mt-1 block h-10 w-28 rounded-md border border-line px-3 text-sm font-normal"
        />
      </label>
      <label className="text-xs font-bold">
        사유 (선택)
        <input
          value={reason}
          maxLength={100}
          onChange={(e) => setReason(e.target.value)}
          placeholder="입고, 불량, 재고 실사"
          className="mt-1 block h-10 w-44 rounded-md border border-line px-3 text-sm font-normal"
        />
      </label>
      <Button type="submit" size="sm" loading={saving} disabled={!change.trim()}>적용</Button>
      <div className="w-full text-xs" aria-live="polite">
        {error ? (
          <span className="text-danger">{error}</span>
        ) : parsed && "error" in parsed ? (
          <span className="text-danger">{parsed.error}</span>
        ) : preview ? (
          <span className={preview.ok ? "text-muted" : "text-danger"}>적용 후 {preview.after}개{!preview.ok && " (0개 미만은 안 돼요)"}</span>
        ) : done ? (
          <span className="text-brand-strong">반영했어요: {done}</span>
        ) : null}
      </div>
    </form>
  );
}
