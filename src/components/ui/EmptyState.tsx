import type { ReactNode } from "react";
interface EmptyStateProps { title: string; description?: string; action?: ReactNode; }
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-lg bg-white px-6 text-center">
      <span className="mb-4 grid size-14 place-items-center rounded-full bg-neutral-100 text-2xl" aria-hidden="true">♡</span>
      <h2 className="text-lg font-black">{title}</h2>
      {description && <p className="mt-2 max-w-sm text-sm leading-6 text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
