import Link from "next/link";
import { AccountActions } from "./AccountActions";
import { BackButton } from "./BackButton";
import { CartButton } from "./CartButton";
import { SearchIcon } from "./Icons";
import { Logo } from "./Logo";
import { MobileMenu } from "./MobileMenu";

// 모든 페이지 맨 위 한 줄: 왼쪽 뒤로 가기 · 가운데 로고 · 오른쪽 검색·장바구니·로그인 (모바일은 검색·장바구니·햄버거 메뉴)
// 메인 배너 안에서는 뒤로 가기를 숨김 (showBack=false). 주소(usePathname)로 판단하면 빌드 시 미리 렌더링이 막힘
export function TopBar({ showBack = true }: { showBack?: boolean }) {
  return (
    <div className="content-shell grid h-14 grid-cols-[1fr_auto_1fr] items-center md:h-16">
      <div className="col-start-1 flex items-center justify-start">
        {showBack && <BackButton />}
      </div>
      <div className="col-start-2">
        <Logo />
      </div>
      <div className="col-start-3 flex items-center justify-end gap-1 sm:gap-2">
        <Link href="/search" aria-label="상품 검색" className="brand-gradient-icon-hover grid size-10 place-items-center rounded-full">
          <SearchIcon />
        </Link>
        <CartButton />
        <AccountActions />
        <MobileMenu />
      </div>
    </div>
  );
}
