import type { Metadata } from "next";
import { Geist } from "next/font/google";
import type { ReactNode } from "react";
import { KantBot } from "@/components/chatbot/KantBot";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
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
            <Header />
            <main id="main-content" className="min-w-0 flex-1 pb-16 md:pb-0">{children}</main>
            <Footer />
            <MobileBottomNav />
          </div>
          <KantBot />
        </AuthProvider>
      </body>
    </html>
  );
}
