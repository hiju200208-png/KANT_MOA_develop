import { Suspense } from "react";
import { AdminProductDetailView } from "@/components/admin/AdminProductDetailView";
import { Skeleton } from "@/components/ui";

export default function AdminProductDetailPage() {
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full" />}>
      <AdminProductDetailView />
    </Suspense>
  );
}
