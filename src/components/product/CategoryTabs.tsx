import Link from "next/link";
import type { Category } from "@/types/app";

interface CategoryTabsProps {
  categories: Category[];
  current: string;
}

export function CategoryTabs({ categories, current }: CategoryTabsProps) {
  return (
    <nav aria-label="카테고리" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex w-max gap-2">
        {categories.map((category) => {
          const active = category.slug === current;
          return (
            <li key={category.id}>
              <Link
                href={`/category/${category.slug}`}
                aria-current={active ? "page" : undefined}
                className={`inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold transition-all ${active ? "border-foreground bg-foreground" : "brand-gradient-soft-hover border-line bg-white hover:border-violet-300"}`}
              >
                <span className={active ? "text-white" : "text-foreground"}>{category.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
