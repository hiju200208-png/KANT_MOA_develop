import { Logo } from "@/components/layout/Logo";
import type { ReactNode } from "react";

interface AuthShellProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <section className="relative isolate flex min-h-[calc(100dvh-8rem)] items-center justify-center overflow-hidden px-4 py-14">
      <div className="absolute -left-24 top-12 -z-10 size-72 rounded-full bg-brand/15 blur-3xl" />
      <div className="absolute -right-20 bottom-12 -z-10 size-72 rounded-full bg-violet-200/45 blur-3xl" />
      <div className="w-full max-w-md rounded-lg border border-white/70 bg-white p-6 shadow-card sm:p-9">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="mb-7 text-center">
          <h1 className="text-2xl font-black tracking-[-0.04em]">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
        </div>
        {children}
      </div>
    </section>
  );
}
