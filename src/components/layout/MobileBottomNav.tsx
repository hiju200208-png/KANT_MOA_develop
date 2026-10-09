import Link from "next/link";
import { CartIcon, GridIcon, HomeIcon, UserIcon } from "./Icons";
const items = [
  { href: "/", label: "홈", Icon: HomeIcon },
  { href: "/artists", label: "아티스트", Icon: GridIcon },
  { href: "/cart", label: "장바구니", Icon: CartIcon },
  { href: "/mypage", label: "마이", Icon: UserIcon },
];
export function MobileBottomNav() {
  return (
    <nav aria-label="모바일 메뉴" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden">
      <div className="grid h-16 grid-cols-4">
        {items.map(({ href, label, Icon }) => <Link key={href} href={href} className="brand-gradient-soft-hover flex flex-col items-center justify-center gap-1 rounded-md text-[11px] font-semibold text-muted"><Icon className="size-5" />{label}</Link>)}
      </div>
    </nav>
  );
}
