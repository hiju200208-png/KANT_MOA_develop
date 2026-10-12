"use client";

import { Button, Input } from "@/components/ui";
import { getErrorMessage } from "@/constants/error-messages";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      const { signIn } = await import("@/services/auth");
      await signIn({ email, password });
      const requestedPath = new URLSearchParams(window.location.search).get("next");
      const nextPath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/";
      router.replace(nextPath);
      router.refresh();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input label="이메일" name="email" type="email" autoComplete="email" placeholder="email@example.com" required />
      <Input label="비밀번호" name="password" type="password" autoComplete="current-password" placeholder="비밀번호를 입력해주세요" minLength={6} required />
      {error && <p role="alert" aria-live="polite" className="rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-danger">{error}</p>}
      <Button type="submit" size="lg" fullWidth loading={loading}>로그인</Button>
      <p className="text-center text-sm text-muted">
        아직 회원이 아니신가요?{" "}
        <Link href="/signup" className="brand-gradient-text-hover font-bold text-brand-strong">회원가입</Link>
      </p>
    </form>
  );
}
