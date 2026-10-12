import type { HTMLAttributes } from "react";
export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-lg border border-black/[0.035] bg-white shadow-card ${className}`} {...props} />;
}
