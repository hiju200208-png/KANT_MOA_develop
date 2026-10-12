import Link from "next/link";
import type { Category } from "@/types/app";

interface ArtistCategoryTabsProps {
  basePath: string;
  categories: Category[];
  /** 선택된 카테고리 slug. 없으면 전체 */
  current?: string;
}

// 아티스트 페이지 안에서 카테고리별로 상품을 거르는 탭 (?category=slug)
export function ArtistCategoryTabs({ basePath, categories, current }: ArtistCategoryTabsProps) {
  const tabs = [{ slug: undefined, name: "전체", key: "all" }, ...categories.map((category) => ({ slug: category.slug, name: category.name, key: category.slug }))];

  return (
    <nav aria-label="카테고리" className="-mx-5 overflow-x-auto px-5 md:-mx-6 md:px-6">
      <ul className="flex w-max gap-2">
        {tabs.map((tab) => {
          const active = tab.slug === current;
          return (
            <li key={tab.key}>
              <Link
                href={tab.slug ? `${basePath}?category=${tab.slug}` : basePath}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={`inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold transition-all ${active ? "border-foreground bg-foreground" : "brand-gradient-soft-hover border-line bg-white hover:border-violet-300"}`}
              >
                <span className={active ? "text-white" : "text-foreground"}>{tab.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
