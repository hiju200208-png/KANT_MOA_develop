import { Fredoka } from "next/font/google";
import Link from "next/link";
import { POPULAR_CATEGORY } from "@/components/product/popularCategory";
import { AccountActions } from "./AccountActions";
import { CartButton } from "./CartButton";

// 가운데 로고용 둥근 글꼴 (파스텔 무드·기존 버블 로고 느낌)
const wordmarkFont = Fredoka({ subsets: ["latin"], weight: ["600", "700"] });

// 모든 페이지 맨 위 한 줄: 왼쪽 바로가기 · 가운데 로고 · 오른쪽 장바구니·로그인
export function TopBar() {
  return (
    <div className="content-shell grid h-14 grid-cols-[1fr_auto_1fr] items-center md:h-16">
      <nav aria-label="바로가기" className="hidden gap-1 text-sm font-semibold md:flex">
        <Link href="/artists" className="rounded-full px-3 py-2 hover:bg-black/5">아티스트</Link>
        <Link href={`/category/${POPULAR_CATEGORY.slug}`} className="rounded-full px-3 py-2 hover:bg-black/5">카테고리</Link>
      </nav>
      <Link href="/" aria-label="KANT MOA 홈" className={`${wordmarkFont.className} col-start-2 text-[26px] leading-none font-bold tracking-[0.04em] md:text-[30px]`}>
        KANT<span aria-hidden="true" className="mx-1 text-violet-600">·</span>MOA
      </Link>
      <div className="col-start-3 flex items-center justify-end gap-1 sm:gap-2">
        <CartButton />
        <AccountActions />
      </div>
    </div>
  );
}
