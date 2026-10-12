"use client";

import { usePathname, useRouter } from "next/navigation";

export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/") return null;

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="뒤로 가기"
      title="뒤로 가기"
      className="brand-gradient-soft-hover grid size-10 place-items-center rounded-full text-2xl leading-none"
    >
      <span aria-hidden="true">←</span>
    </button>
  );
}
