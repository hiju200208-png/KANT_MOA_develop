import Link from "next/link";
import type { ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import { PageMain } from "@/components/layout/PageMain";
import { AdminSession } from "@/components/admin/AdminSession";

// 관리자 화면 공통: 기존 헤더 + 관리자 메뉴. 접근 권한은 서버 API(require_admin)가 401/403으로 막는다.
const MENU = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/products", label: "상품·재고" },
  { href: "/admin/orders", label: "주문·배송" },
  { href: "/admin/notices", label: "공지" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <PageMain>
        <div className="content-shell py-6 md:py-10">
          <nav aria-label="관리자 메뉴" className="mb-6 flex items-center gap-2 overflow-x-auto whitespace-nowrap border-b border-line pb-3">
            <span className="mr-2 shrink-0 text-xs font-black tracking-widest text-muted">ADMIN</span>
            {MENU.map((item) => (
              <Link key={item.href} href={item.href} className="shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold hover:bg-neutral-100">
                {item.label}
              </Link>
            ))}
            <AdminSession />
          </nav>
          {children}
        </div>
      </PageMain>
    </>
  );
}
