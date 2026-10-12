import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "회원가입" };

export default function SignupPage() {
  return (
    <AuthShell title="KANT MOA에 오신 걸 환영해요" description="좋아하는 아티스트의 굿즈를 한곳에서 만나보세요.">
      <SignupForm />
    </AuthShell>
  );
}
