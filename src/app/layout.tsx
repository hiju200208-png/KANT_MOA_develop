import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Suspense, type ReactNode } from "react";
import { FloatingButtons } from "@/components/layout/FloatingButtons";
import { Footer } from "@/components/layout/Footer";
import { AuthProvider } from "@/components/providers/AuthProvider";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "KANT MOA", template: "%s | KANT MOA" },
  description: "좋아하는 아티스트의 공식 굿즈를 한곳에서 만나보세요.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={geist.variable}>
      <body>
        <a className="skip-link" href="#main-content">본문 바로가기</a>
        <AuthProvider>
          <div className="flex min-h-dvh flex-col">
            {/* 헤더와 본문(main)은 그룹 레이아웃이 그림: (home)은 헤더 없음, (shop)·(auth)는 흰색 헤더 */}
            {children}
            <Footer />
          </div>
          <Suspense fallback={null}>
            <FloatingButtons />
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}
