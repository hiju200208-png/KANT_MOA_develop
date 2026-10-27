import { Suspense } from "react";
import { AdminProductList } from "@/components/admin/AdminProductList";
import { Skeleton } from "@/components/ui";

// 대시보드 카드에서 ?status=…&stock=… 로 들어오므로 쿼리를 읽는 목록을 Suspense로 감싼다
export default function AdminProductsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full" />}>
      <AdminProductList />
    </Suspense>
  );
}
