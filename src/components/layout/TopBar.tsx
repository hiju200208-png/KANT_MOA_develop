import { AccountActions } from "./AccountActions";
import { BackButton } from "./BackButton";
import { CartButton } from "./CartButton";
import { Logo } from "./Logo";

// 모든 페이지 맨 위 한 줄: 가운데 로고 · 오른쪽 장바구니·로그인
export function TopBar() {
  return (
    <div className="content-shell grid h-14 grid-cols-[1fr_auto_1fr] items-center md:h-16">
      <div className="col-start-1 flex items-center justify-start">
        <BackButton />
      </div>
      <div className="col-start-2">
        <Logo />
      </div>
      <div className="col-start-3 flex items-center justify-end gap-1 sm:gap-2">
        <CartButton />
        <AccountActions />
      </div>
    </div>
  );
}
