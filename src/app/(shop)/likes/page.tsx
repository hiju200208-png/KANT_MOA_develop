import { redirect } from "next/navigation";

// 좋아요한 상품은 "최근 본 상품" 페이지의 좋아요 탭에서 보여준다 (예전 주소 호환)
export default function LikesPage() {
  redirect("/recently-viewed?tab=likes");
}
