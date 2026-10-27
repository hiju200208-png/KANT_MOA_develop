import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "상품을 찾을 수 없어요" };

// 없는 상품 번호(/products/999999)나 숨김 처리된 상품에서 보여주는 화면
export default function ProductNotFound() {
  return (
    <div className="content-shell flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      {/* 고객에게 상태 코드(404)는 보여주지 않는다 */}
      <span aria-hidden="true" className="grid size-16 place-items-center rounded-full bg-neutral-100 text-3xl">
        🔍
      </span>
      <h1 className="mt-4 text-2xl font-black tracking-[-0.035em] md:text-3xl">상품을 찾을 수 없어요</h1>
      <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
        판매가 끝났거나 주소가 바뀐 상품일 수 있어요.
        <br />
        전체 상품에서 다른 굿즈를 둘러보세요.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/products" className="inline-flex h-12 items-center rounded-full bg-foreground px-6 text-sm font-bold transition-colors hover:bg-neutral-800">
          <span className="text-white">전체 상품 보기</span>
        </Link>
        <Link href="/" className="brand-gradient-soft-hover inline-flex h-12 items-center rounded-full border border-line bg-white px-6 text-sm font-bold">
          홈으로 가기
        </Link>
      </div>
    </div>
  );
}
