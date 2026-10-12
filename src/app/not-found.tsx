import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { PageMain } from "@/components/layout/PageMain";

export const metadata: Metadata = { title: "페이지를 찾을 수 없어요" };

// 없는 주소, 없는 상품·아티스트·카테고리(notFound())에서 보여주는 화면. 루트 레이아웃 바로 아래에서 그려져 헤더·본문 틀을 직접 둔다.
export default function NotFound() {
  return (
    <>
      <Header />
      <PageMain>
        <div className="content-shell flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
          <p aria-hidden="true" className="bg-[linear-gradient(135deg,var(--brand-strong),#8a70df_55%,#df74aa)] bg-clip-text text-7xl font-black tracking-tight text-transparent md:text-8xl">
            404
          </p>
          <h1 className="mt-4 text-2xl font-black tracking-[-0.035em] md:text-3xl">페이지를 찾을 수 없어요</h1>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
            주소가 바뀌었거나 판매가 끝난 상품일 수 있어요.
            <br />
            홈이나 아티스트 페이지에서 다시 찾아보세요.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/" className="inline-flex h-12 items-center rounded-full bg-foreground px-6 text-sm font-bold transition-colors hover:bg-neutral-800">
              <span className="text-white">홈으로 가기</span>
            </Link>
            <Link href="/artists" className="brand-gradient-soft-hover inline-flex h-12 items-center rounded-full border border-line bg-white px-6 text-sm font-bold">
              아티스트 둘러보기
            </Link>
          </div>
        </div>
      </PageMain>
    </>
  );
}
