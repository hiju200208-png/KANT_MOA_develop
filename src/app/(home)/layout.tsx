import type { ReactNode } from "react";
import { PageMain } from "@/components/layout/PageMain";

// 메인: 전역 헤더 없음. 배너(HomeSpotlight) 안의 TopBar가 동적 배경 위에서 헤더 역할을 한다
export default function HomeLayout({ children }: { children: ReactNode }) {
  return <PageMain>{children}</PageMain>;
}
