"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoginRequired } from "@/components/order/LoginRequired";
import { useAuth } from "@/components/providers/AuthProvider";
import { Badge, Button, Card, SectionHeader, Skeleton } from "@/components/ui";
import { getErrorMessage } from "@/constants/error-messages";
import { signOut } from "@/services/auth";

type MenuItem = { label: string; href?: string };

// href가 없으면 준비 중인 메뉴
const MENU: { title: string; items: MenuItem[] }[] = [
  {
    title: "쇼핑",
    items: [{ label: "주문/취소 내역", href: "/orders" }],
  },
  {
    title: "내 정보",
    items: [
      { label: "배송 주소 관리", href: "/mypage/addresses" },
      { label: "내 정보 수정", href: "/mypage/profile" },
    ],
  },
];

export default function MyPage() {
  const router = useRouter();
  const { profile, initialized } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setSigningOut(true);
    setError(null);
    try {
      await signOut();
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(getErrorMessage(e));
      setSigningOut(false);
    }
  }

  if (!initialized) {
    return (
      <div className="content-shell max-w-3xl py-8 md:py-12">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="mt-6 h-64 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="content-shell py-8 md:py-12">
        <LoginRequired next="/mypage" />
      </div>
    );
  }

  return (
    <div className="content-shell max-w-3xl py-8 md:py-12">
      <SectionHeader title="마이페이지" />
      <div className="space-y-6">
        <Card className="flex items-center justify-between gap-4 p-6">
          <div className="min-w-0 space-y-1">
            <p className="truncate text-lg font-black">{profile.nickname}</p>
            <p className="truncate text-sm text-muted">{profile.email}</p>
          </div>
          <Button className="brand-gradient-soft-hover" variant="outline" size="sm" loading={signingOut} onClick={handleSignOut}>로그아웃</Button>
        </Card>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}

        {MENU.map((section) => (
          <section key={section.title} aria-labelledby={`menu-${section.title}`}>
            <h2 id={`menu-${section.title}`} className="mb-2 px-1 text-sm font-bold text-muted">{section.title}</h2>
            <Card className="overflow-hidden">
              <ul className="divide-y divide-line">
                {section.items.map((item) => (
                  <li key={item.label}>
                    {item.href ? (
                      <Link href={item.href} className="brand-gradient-soft-hover group flex min-h-14 items-center justify-between gap-4 px-5 font-bold">
                        {item.label}
                        <span aria-hidden="true" className="text-muted transition-transform group-hover:translate-x-1">›</span>
                      </Link>
                    ) : (
                      <div aria-disabled="true" className="flex min-h-14 items-center justify-between gap-4 px-5 font-bold text-muted">
                        {item.label}
                        <Badge className="bg-neutral-100 text-muted">준비 중</Badge>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ))}
      </div>
    </div>
  );
}
