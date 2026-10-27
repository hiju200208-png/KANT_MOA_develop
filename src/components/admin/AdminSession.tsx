"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { adminLogout, getMe } from "@/services/admin/api";
import { getAdminAccessToken } from "@/services/admin/client";
import type { AuthUser } from "@/types/admin";

// 로그인·로그아웃 후 다른 관리자 컴포넌트에 알리는 이벤트
export const ADMIN_AUTH_EVENT = "kantmoa-admin-auth";
export const notifyAdminAuthChanged = () => window.dispatchEvent(new Event(ADMIN_AUTH_EVENT));

// 관리자 메뉴 오른쪽: 로그인한 관리자 이름 + 로그아웃, 비로그인이면 로그인 링크
export function AdminSession() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checked, setChecked] = useState(false);

  const refresh = useCallback(async () => {
    if (!getAdminAccessToken()) {
      setUser(null);
      setChecked(true);
      return;
    }
    try {
      setUser(await getMe());
    } catch {
      setUser(null); // 만료·로그아웃된 토큰
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 처음 열릴 때와 로그인·로그아웃 때 내 정보를 다시 확인한다
    void refresh();
    window.addEventListener(ADMIN_AUTH_EVENT, refresh);
    return () => window.removeEventListener(ADMIN_AUTH_EVENT, refresh);
  }, [refresh]);

  async function handleLogout() {
    await adminLogout().catch(() => undefined);
    notifyAdminAuthChanged();
    router.push("/admin/login");
  }

  if (!checked) return null;
  if (!user) {
    return (
      <Link href="/admin/login" className="ml-auto text-sm font-bold underline">
        관리자 로그인
      </Link>
    );
  }
  return (
    <div className="ml-auto flex items-center gap-2 text-sm">
      <span className="text-muted">
        <b className="text-foreground">{user.nickname}</b> ({user.role === "ADMIN" ? "관리자" : "일반 회원"})
      </span>
      <Button size="sm" variant="outline" onClick={handleLogout}>
        로그아웃
      </Button>
    </div>
  );
}
