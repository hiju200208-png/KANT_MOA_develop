import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "비밀번호 재설정" };

export default function ResetPasswordPage() {
  return (
    <AuthShell title="새 비밀번호 설정" description="새로 사용할 비밀번호를 입력해주세요.">
      <ResetPasswordForm />
    </AuthShell>
  );
}
