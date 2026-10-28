import type { Metadata } from "next";
import { StatusView } from "@/components/feedback/StatusView";
import { Header } from "@/components/layout/Header";
import { PageMain } from "@/components/layout/PageMain";

export const metadata: Metadata = { title: "페이지를 찾을 수 없어요" };
export default function NotFound() {
  return <><Header /><PageMain><div className="content-shell min-h-[60vh] py-10 md:py-16"><StatusView variant="not-found" /></div></PageMain></>;
}
