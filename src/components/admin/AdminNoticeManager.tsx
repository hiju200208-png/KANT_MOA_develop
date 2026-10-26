"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Badge, Button, EmptyState, Modal, PageTitle, Skeleton } from "@/components/ui";
import { emptyNoticeForm, toNoticeInput, validateNoticeForm, type NoticeFormValues } from "@/services/admin/adminForm";
import { createNotice, deleteNotice, listAdminNotices, updateNotice } from "@/services/admin/api";
import { adminErrorMessage } from "@/services/admin/client";
import type { AdminNotice, Page } from "@/types/admin";
import { AdminErrorBox } from "./AdminParts";

const fieldClass = "mt-1 block w-full rounded-md border border-line px-3 py-2 text-sm font-normal";

function toForm(notice: AdminNotice): NoticeFormValues {
  return {
    title: notice.title,
    body: notice.body ?? "",
    artistSlug: notice.artist?.slug ?? "",
    productId: notice.product_id ? String(notice.product_id) : "",
    isPinned: notice.is_pinned,
    showInTopbar: notice.show_in_topbar,
  };
}

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

// 공지 관리: 목록 + 등록/수정 폼 + 삭제 확인
export function AdminNoticeManager() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<AdminNotice> | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [editing, setEditing] = useState<AdminNotice | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminNotice | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (target: number) => {
    setError(null);
    try {
      setData(await listAdminNotices(target));
    } catch (e) {
      setError(e);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 페이지가 바뀌면 목록을 다시 받는다
    void load(page);
  }, [page, load]);

  async function handleSaved(text: string) {
    setEditing(null);
    setMessage(text);
    await load(page);
  }

  async function handleDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteNotice(deleting.id);
      setMessage(`'${deleting.title}' 공지를 삭제했어요.`);
      setDeleting(null);
      await load(page);
    } catch (e) {
      setMessage(adminErrorMessage(e));
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  return (
    <section>
      <div className="flex items-start justify-between gap-3">
        <PageTitle title="공지 관리" description="상단 고정 공지가 먼저, 그다음 최신순으로 보여요." />
        {editing === null && <Button size="sm" onClick={() => { setEditing("new"); setMessage(null); }}>새 공지</Button>}
      </div>

      {message && <p role="status" className="mb-3 rounded-md bg-neutral-100 px-4 py-2 text-sm">{message}</p>}

      {editing !== null && (
        <NoticeForm
          key={editing === "new" ? "new" : editing.id}
          notice={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      {error ? (
        <AdminErrorBox error={error} onRetry={() => load(page)} />
      ) : !data ? (
        <div className="space-y-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : data.items.length === 0 ? (
        <EmptyState title="등록된 공지가 없어요." description="'새 공지'로 첫 공지를 등록해보세요." />
      ) : (
        <>
          <ul className="divide-y divide-line rounded-lg border border-line bg-white">
            {data.items.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 font-bold">
                    {n.is_pinned && <Badge>고정</Badge>}
                    {n.show_in_topbar && <Badge className="bg-neutral-100 text-neutral-700">상단 띠</Badge>}
                    <span className="truncate">{n.title}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {n.artist ? n.artist.name : "전체 공지"}
                    {n.product_name && ` · 연결 상품: ${n.product_name}`} · {formatDate(n.published_at)}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => { setEditing(n); setMessage(null); }}>수정</Button>
                <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleting(n)}>삭제</Button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-center gap-3 text-sm">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>이전</Button>
            <span className="tabular-nums">{page} / {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>다음</Button>
          </div>
        </>
      )}

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="공지를 삭제할까요?"
        description={deleting ? `'${deleting.title}' 공지가 손님 화면에서도 사라져요. 되돌릴 수 없어요.` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleting(null)}>취소</Button>
            <Button variant="danger" size="sm" loading={busy} onClick={handleDelete}>삭제</Button>
          </div>
        }
      />
    </section>
  );
}

function NoticeForm({
  notice,
  onCancel,
  onSaved,
}: {
  notice: AdminNotice | null;
  onCancel: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const [values, setValues] = useState<NoticeFormValues>(notice ? toForm(notice) : emptyNoticeForm());
  const [errors, setErrors] = useState<ReturnType<typeof validateNoticeForm>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof NoticeFormValues>(key: K, value: NoticeFormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateNoticeForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    setServerError(null);
    try {
      const input = toNoticeInput(values);
      if (notice) {
        await updateNotice(notice.id, input);
        await onSaved("공지를 수정했어요.");
      } else {
        await createNotice(input);
        await onSaved("공지를 등록했어요.");
      }
    } catch (e) {
      setServerError(adminErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 space-y-4 rounded-lg border border-line bg-white p-5" noValidate>
      <h2 className="text-lg font-black">{notice ? "공지 수정" : "새 공지"}</h2>
      <label className="block text-sm font-bold">
        제목
        <input value={values.title} maxLength={100} onChange={(e) => set("title", e.target.value)} className={fieldClass} aria-invalid={Boolean(errors.title)} />
        {errors.title && <span className="mt-1 block text-xs text-danger">{errors.title}</span>}
      </label>
      <label className="block text-sm font-bold">
        본문 <span className="font-normal text-muted">(줄 단위로 보여요. &quot;## &quot; 섹션 제목, &quot;- &quot; 목록, &quot;※ &quot; 주의)</span>
        <textarea value={values.body} rows={8} maxLength={5000} onChange={(e) => set("body", e.target.value)} className={fieldClass} />
        {errors.body && <span className="mt-1 block text-xs text-danger">{errors.body}</span>}
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-bold">
          아티스트 slug <span className="font-normal text-muted">(비우면 전체 공지)</span>
          <input value={values.artistSlug} onChange={(e) => set("artistSlug", e.target.value)} placeholder="예: bts" className={fieldClass} />
          {errors.artistSlug && <span className="mt-1 block text-xs text-danger">{errors.artistSlug}</span>}
        </label>
        <label className="block text-sm font-bold">
          연결 상품 번호 <span className="font-normal text-muted">(선택, &quot;상품 보러가기&quot;)</span>
          <input value={values.productId} inputMode="numeric" onChange={(e) => set("productId", e.target.value)} className={fieldClass} />
          {errors.productId && <span className="mt-1 block text-xs text-danger">{errors.productId}</span>}
        </label>
      </div>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={values.isPinned} onChange={(e) => set("isPinned", e.target.checked)} /> 상단 고정
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={values.showInTopbar} onChange={(e) => set("showInTopbar", e.target.checked)} /> 맨 위 띠 배너에 표시
        </label>
      </div>
      {serverError && <p role="alert" className="text-sm text-danger">{serverError}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>취소</Button>
        <Button type="submit" size="sm" loading={saving}>{notice ? "수정" : "등록"}</Button>
      </div>
    </form>
  );
}
