import { Suspense } from "react";
import { OrderList } from "@/components/order/OrderList";
import { PageTitle, Skeleton } from "@/components/ui";

// cacheComponents 사용 중이라 검색 파라미터(?status=)를 읽는 클라이언트 컴포넌트는 Suspense로 감싼다.
export default function OrdersPage() {
  return (
    <div className="content-shell py-8 md:py-12">
      <PageTitle title="주문/취소 내역" />
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-11 w-full max-w-md rounded-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        }
      >
        <OrderList />
      </Suspense>
    </div>
  );
}
