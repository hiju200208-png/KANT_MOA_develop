"use client";

import { Button, Input } from "@/components/ui";
import { getErrorMessage } from "@/constants/error-messages";
import Link from "next/link";
import { useState, type FormEvent } from "react";

export function ForgotPasswordForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ message: string; resetToken: string | null } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    try {
      const { requestPasswordReset } = await import("@/services/auth");
      setDone(await requestPasswordReset(email));
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-5">
        <p role="status" className="rounded-md bg-gray-100 px-4 py-3 text-sm font-medium">{done.message}</p>
        {/* 시연 모드(서버 PASSWORD_RESET_DEMO=true)에서만 링크가 내려온다. 운영에서는 메일로만 전달. */}
        {done.resetToken && (
          <Link
            href={`/reset-password?token=${encodeURIComponent(done.resetToken)}`}
            className="block rounded-md border border-line px-4 py-3 text-center text-sm font-bold text-brand-strong"
          >
            [시연] 비밀번호 재설정 링크 열기
          </Link>
        )}
        <p className="text-center text-sm text-muted">
          <Link href="/login" className="font-bold text-brand-strong">로그인으로 돌아가기</Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input label="이메일" name="email" type="email" autoComplete="email" placeholder="email@example.com" required />
      {error && <p role="alert" aria-live="polite" className="rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-danger">{error}</p>}
      <Button type="submit" size="lg" fullWidth loading={loading}>재설정 안내 받기</Button>
      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-bold text-brand-strong">로그인으로 돌아가기</Link>
      </p>
    </form>
  );
}
