import { AccountActions } from "./AccountActions";
import { CartButton } from "./CartButton";
import { Logo } from "./Logo";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur-lg">
      <div className="content-shell flex h-16 items-center gap-6 md:h-[72px]">
        <Logo />
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <CartButton />
          <AccountActions />
        </div>
      </div>
    </header>
  );
}
