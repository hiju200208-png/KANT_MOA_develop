import { Suspense } from "react";
import { OrderDetail } from "@/components/order/OrderDetail";
import { Skeleton } from "@/components/ui";

// cacheComponents 사용 중이라 라우트 파라미터를 읽는 클라이언트 컴포넌트는 Suspense로 감싼다.
export default function OrderDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="content-shell py-8 md:py-12">
          <Skeleton className="h-72 w-full" />
        </div>
      }
    >
      <OrderDetail />
    </Suspense>
  );
}
