"use client";

import { Button, Input } from "@/components/ui";
import { getErrorMessage } from "@/constants/error-messages";
import { ApiError } from "@/services/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const INVALID_LINK = "재설정 링크가 만료되었거나 이미 사용되었어요. 다시 요청해주세요.";

export function ResetPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");
    const token = new URLSearchParams(window.location.search).get("token") ?? "";

    if (!token) return setError(INVALID_LINK);
    if (password !== confirm) return setError("비밀번호가 서로 달라요. 다시 확인해주세요.");

    setLoading(true);
    try {
      const { confirmPasswordReset } = await import("@/services/auth");
      await confirmPasswordReset(token, password);
      router.replace("/login");
    } catch (submitError) {
      setError(submitError instanceof ApiError && submitError.status === 400 ? INVALID_LINK : getErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input label="새 비밀번호" name="password" type="password" autoComplete="new-password" placeholder="8자 이상 입력해주세요" minLength={8} maxLength={128} required />
      <Input label="새 비밀번호 확인" name="confirm" type="password" autoComplete="new-password" placeholder="한 번 더 입력해주세요" minLength={8} maxLength={128} required />
      {error && <p role="alert" aria-live="polite" className="rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-danger">{error}</p>}
      <Button type="submit" size="lg" fullWidth loading={loading}>비밀번호 변경</Button>
      <p className="text-center text-sm text-muted">
        <Link href="/forgot-password" className="font-bold text-brand-strong">링크를 다시 받으려면</Link>
      </p>
    </form>
  );
}
