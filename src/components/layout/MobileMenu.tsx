"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { CartIcon, GridIcon, HomeIcon, UserIcon } from "./Icons";

const links = [
  { href: "/", label: "홈", Icon: HomeIcon },
  { href: "/artists", label: "아티스트", Icon: GridIcon },
  { href: "/recently-viewed", label: "최근 본 상품", Icon: ClockIcon },
  { href: "/cart", label: "장바구니", Icon: CartIcon },
];

// 모바일 상단 장바구니 옆 햄버거 버튼 → 오른쪽에서 열리는 메뉴 (md 이상은 숨김).
// 네이티브 <dialog>라 ESC 닫기·포커스 가두기를 브라우저가 처리
export function MobileMenu() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { profile, initialized } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const close = () => dialogRef.current?.close();

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const { signOut } = await import("@/services/auth");
      await signOut();
      close();
      router.replace("/");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  const itemClass = "brand-gradient-soft-hover flex h-13 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold";

  return (
    <>
      <button type="button" aria-label="메뉴 열기" aria-haspopup="dialog" onClick={() => dialogRef.current?.showModal()} className="brand-gradient-icon-hover grid size-10 place-items-center rounded-full md:hidden">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      <dialog
        ref={dialogRef}
        aria-label="메뉴"
        // 배경(backdrop)을 누르면 닫기: 클릭 대상이 dialog 자신이면 바깥 영역
        onClick={(event) => event.target === event.currentTarget && close()}
        className="m-0 ml-auto h-dvh max-h-none w-[min(80vw,320px)] max-w-none bg-white p-0 backdrop:bg-black/40 motion-safe:open:animate-[menu-in_200ms_ease-out] md:hidden"
      >
        <div className="flex h-full flex-col px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex h-11 items-center justify-between">
            <span className="text-sm font-bold text-muted">메뉴</span>
            <button type="button" aria-label="메뉴 닫기" onClick={close} className="grid size-10 place-items-center rounded-full text-xl hover:bg-neutral-100">
              ×
            </button>
          </div>

          <nav aria-label="모바일 메뉴" className="mt-2">
            <ul className="space-y-1">
              {links.map(({ href, label, Icon }) => (
                <li key={href}>
                  <Link href={href} onClick={close} className={itemClass}>
                    <Icon className="size-5" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-auto border-t border-line pt-4">
            {!initialized ? null : profile ? (
              <div className="space-y-1">
                <Link href="/mypage" onClick={close} className={itemClass}>
                  <UserIcon className="size-5" />
                  마이페이지
                </Link>
                <button type="button" onClick={handleSignOut} disabled={signingOut} className={`${itemClass} w-full text-muted disabled:cursor-wait`}>
                  {signingOut ? "로그아웃 중" : "로그아웃"}
                </button>
              </div>
            ) : (
              <Link href="/login" onClick={close} className="flex h-12 items-center justify-center rounded-full bg-foreground text-[15px] font-bold">
                <span className="text-white">로그인</span>
              </Link>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}

function ClockIcon(props: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
