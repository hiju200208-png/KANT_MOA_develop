import type { ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import { PageMain } from "@/components/layout/PageMain";

// 메인 외 페이지: 흰색 전역 헤더 + 본문
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <PageMain>{children}</PageMain>
    </>
  );
}
