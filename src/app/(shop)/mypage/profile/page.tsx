"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { LoginRequired } from "@/components/order/LoginRequired";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button, Card, Input, SectionHeader, Skeleton } from "@/components/ui";
import { getErrorMessage } from "@/constants/error-messages";
import { updateProfile } from "@/services/auth";
import type { Profile } from "@/types/app";

export default function ProfileEditPage() {
  const { profile: authProfile, initialized } = useAuth();
  // 저장 직후에는 AuthProvider가 새 프로필을 모르므로 저장 결과를 우선 보여준다.
  const [saved, setSaved] = useState<Profile | null>(null);
  const profile = saved?.id === authProfile?.id ? saved : authProfile;
  const [edited, setEdited] = useState<{ nickname?: string; phone?: string }>({});
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const form = {
    nickname: edited.nickname ?? profile?.nickname ?? "",
    phone: edited.phone ?? profile?.phone ?? "",
  };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.nickname.trim()) return setMessage({ type: "error", text: "닉네임을 입력해주세요." });

    setSaving(true);
    setMessage(null);
    try {
      setSaved(await updateProfile({ nickname: form.nickname.trim(), phone: form.phone.trim() || null }));
      setEdited({});
      setMessage({ type: "ok", text: "저장했어요." });
    } catch (error) {
      setMessage({ type: "error", text: getErrorMessage(error) });
    }
    setSaving(false);
  }

  if (!initialized) {
    return (
      <div className="content-shell max-w-3xl py-8 md:py-12">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="content-shell py-8 md:py-12">
        <LoginRequired next="/mypage/profile" />
      </div>
    );
  }

  return (
    <div className="content-shell max-w-3xl py-8 md:py-12">
      <Link href="/mypage" className="brand-gradient-text-hover mb-4 inline-flex min-h-11 items-center text-sm font-bold text-muted">
        <span aria-hidden="true">‹</span>&nbsp;마이페이지
      </Link>
      <SectionHeader title="내 정보 수정" />
      <Card className="p-6">
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <Input label="이메일" name="email" value={profile.email} disabled hint="이메일은 변경할 수 없어요." />
          <Input label="닉네임" name="nickname" value={form.nickname} onChange={(e) => setEdited((prev) => ({ ...prev, nickname: e.target.value }))} />
          <Input label="연락처" name="phone" type="tel" inputMode="tel" placeholder="01012345678" hint="주문서의 연락처 기본값으로 쓰여요." value={form.phone} onChange={(e) => setEdited((prev) => ({ ...prev, phone: e.target.value }))} />
          {message && (
            <p role={message.type === "error" ? "alert" : "status"} className={`text-sm ${message.type === "error" ? "text-danger" : "text-brand-strong"}`}>
              {message.text}
            </p>
          )}
          <Button type="submit" loading={saving}>저장</Button>
        </form>
      </Card>
    </div>
  );
}
