"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Card, Input, PageTitle } from "@/components/ui";
import { validateLogin } from "@/services/admin/adminForm";
import { adminLogin } from "@/services/admin/api";
import { notifyAdminAuthChanged } from "./AdminSession";

// 관리자 로그인: P1 /auth/login으로 토큰을 받고, ADMIN 계정만 관리자 화면으로 보낸다
export function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = validateLogin(email, password);
    if (problem) return setError(problem);
    setLoading(true);
    setError(null);
    try {
      await adminLogin(email, password);
      notifyAdminAuthChanged();
      router.push("/admin");
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "로그인하지 못했어요.");
      notifyAdminAuthChanged();
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-md">
      <PageTitle title="관리자 로그인" description="관리자(ADMIN) 계정만 들어갈 수 있어요." />
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Input label="이메일" name="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input
            label="비밀번호"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" fullWidth loading={loading}>
            로그인
          </Button>
        </form>
      </Card>
    </section>
  );
}
