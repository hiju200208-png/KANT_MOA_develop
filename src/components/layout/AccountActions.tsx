"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserIcon } from "./Icons";

export function AccountActions() {
  const { profile, initialized } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      const { signOut } = await import("@/services/auth");
      await signOut();
      router.replace("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (!initialized) {
    return <span aria-hidden="true" className="hidden h-10 w-[88px] animate-pulse rounded-full bg-neutral-100 sm:block" />;
  }

  if (!profile) {
    return (
      <Link href="/login" className="brand-gradient-soft-hover hidden h-10 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-semibold hover:border-violet-300 sm:flex">
        <UserIcon className="size-[19px]" />
        로그인
      </Link>
    );
  }

  return (
    <div className="hidden items-center gap-1 sm:flex">
      <Link href="/mypage" aria-label="마이페이지" title="마이페이지" className="brand-gradient-soft-hover h-10 rounded-full px-3 text-sm font-bold leading-10">
        MY
      </Link>
      <button type="button" onClick={handleSignOut} disabled={loading} className="brand-gradient-soft-hover h-10 rounded-full px-3 text-sm font-semibold text-muted disabled:cursor-wait">
        {loading ? "로그아웃 중" : "로그아웃"}
      </button>
    </div>
  );
}
