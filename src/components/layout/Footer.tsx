import Link from "next/link";
import { Logo } from "./Logo";
const policyLinks = ["이용약관", "개인정보 처리방침", "배송·환불 안내"];
export function Footer() {
  return (
    <footer className="hidden border-t border-line bg-white py-12 md:block">
      <div className="content-shell grid gap-8 lg:grid-cols-[1fr_auto]">
        <div>
          <Logo />
          <p className="mt-4 max-w-lg text-sm leading-6 text-muted">ORBIT:ON, DAYLOG, SODAFM의 공식 굿즈를 만나는 가장 가까운 곳.</p>
          <p className="mt-6 text-xs text-neutral-400">© 2026 KANT MOA. All rights reserved.</p>
        </div>
        <div className="flex flex-wrap content-start gap-x-6 gap-y-3 text-sm font-medium text-neutral-600">
          {policyLinks.map((label) => <Link key={label} href="/" className="brand-gradient-text-hover">{label}</Link>)}
        </div>
      </div>
    </footer>
  );
}
