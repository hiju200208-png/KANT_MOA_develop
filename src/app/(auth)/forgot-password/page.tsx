import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "비밀번호 찾기" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="비밀번호를 잊으셨나요?" description="가입한 이메일을 입력하면 재설정 방법을 알려드려요.">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
