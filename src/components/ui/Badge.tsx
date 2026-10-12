import type { HTMLAttributes } from "react";
export function Badge({ className = "", ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={`inline-flex h-6 items-center rounded-full bg-brand-soft px-2.5 text-xs font-bold text-brand-strong ${className}`} {...props} />;
}
