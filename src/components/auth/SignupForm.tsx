"use client";

import { Button, Input } from "@/components/ui";
import { getErrorMessage } from "@/constants/error-messages";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const formData = new FormData(event.currentTarget);
    const nickname = String(formData.get("nickname") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

    if (nickname.length < 2) return setError("닉네임은 2자 이상 입력해주세요.");
    if (password.length < 8) return setError("비밀번호는 8자 이상 입력해주세요.");
    if (password !== passwordConfirm) return setError("비밀번호가 일치하지 않아요.");

    setLoading(true);
    try {
      const { signUp } = await import("@/services/auth");
      await signUp({ email, password, nickname });
      router.replace("/");
      router.refresh();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input label="닉네임" name="nickname" autoComplete="nickname" placeholder="2자 이상 입력해주세요" minLength={2} maxLength={20} required />
      <Input label="이메일" name="email" type="email" autoComplete="email" placeholder="email@example.com" required />
      <Input label="비밀번호" name="password" type="password" autoComplete="new-password" placeholder="8자 이상 입력해주세요" minLength={8} required />
      <Input label="비밀번호 확인" name="passwordConfirm" type="password" autoComplete="new-password" placeholder="비밀번호를 다시 입력해주세요" minLength={8} required />
      {error && <p role="alert" aria-live="polite" className="rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-danger">{error}</p>}
      <Button type="submit" size="lg" fullWidth loading={loading}>회원가입</Button>
      <p className="text-center text-sm text-muted">
        이미 회원이신가요?{" "}
        <Link href="/login" className="brand-gradient-text-hover font-bold text-brand-strong">로그인</Link>
      </p>
    </form>
  );
}
