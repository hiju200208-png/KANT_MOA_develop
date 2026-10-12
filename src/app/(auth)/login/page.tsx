import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "로그인" };

export default function LoginPage() {
  return (
    <AuthShell title="다시 만나서 반가워요" description="KANT MOA 계정으로 로그인해주세요.">
      <LoginForm />
    </AuthShell>
  );
}
