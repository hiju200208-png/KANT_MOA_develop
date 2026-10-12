import { Badge } from "@/components/ui";
import type { OrderStatus } from "@/types/app";

const STATUS: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: "결제 대기", className: "bg-amber-50 text-amber-700" },
  paid: { label: "결제 완료", className: "" },
  cancelled: { label: "주문 취소", className: "bg-neutral-100 text-muted" },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, className } = STATUS[status];
  return <Badge className={className}>{label}</Badge>;
}
