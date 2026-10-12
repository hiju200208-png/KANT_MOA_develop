import Link from "next/link";
import { Suspense } from "react";
import { getShopSettings } from "@/services/settings";
import { Logo } from "./Logo";
const policyLinks = ["이용약관", "개인정보 처리방침", "배송·환불 안내"];
export function Footer() {
  return (
    <footer className="hidden border-t border-line bg-white py-12 md:block">
      <div className="content-shell grid gap-8 lg:grid-cols-[1fr_auto]">
        <div>
          <Logo />
          <p className="mt-4 max-w-lg text-sm leading-6 text-muted">좋아하는 아티스트의 공식 굿즈를 만나는 가장 가까운 곳.</p>
          <Suspense fallback={null}>
            <BusinessInfo />
          </Suspense>
          <p className="mt-6 text-xs text-neutral-400">© 2026 KANT MOA. All rights reserved.</p>
        </div>
        <div className="flex flex-wrap content-start gap-x-6 gap-y-3 text-sm font-medium text-neutral-600">
          {policyLinks.map((label) => <Link key={label} href="/" className="brand-gradient-text-hover">{label}</Link>)}
        </div>
      </div>
    </footer>
  );
}

// 사업자·고객센터 정보 (DB shop_settings). 못 불러오면 생략
async function BusinessInfo() {
  const settings = await getShopSettings().catch(() => null);
  if (!settings) return null;
  const items = [
    `상호 ${settings.companyName}`,
    `대표 ${settings.ceoName}`,
    `사업자등록번호 ${settings.businessNumber}`,
    `통신판매업신고 ${settings.ecommerceNumber}`,
    `주소 ${settings.address}`,
    `고객센터 ${settings.csPhone} · ${settings.csHours}`,
  ];
  return (
    <ul className="mt-5 flex max-w-3xl flex-wrap gap-x-3 gap-y-1 text-xs leading-5 text-neutral-500">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}
