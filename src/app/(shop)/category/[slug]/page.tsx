import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CategoryTabs } from "@/components/product/CategoryTabs";
import type { SearchParams } from "@/components/product/listParams";
import { LoadError } from "@/components/product/LoadError";
import { ProductGridSkeleton } from "@/components/product/ProductGrid";
import { ProductListSection } from "@/components/product/ProductListSection";
import { Skeleton } from "@/components/ui";
import { getCategories } from "@/services/products";
import type { Category } from "@/types/app";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}

export default function CategoryPage({ params, searchParams }: CategoryPageProps) {
  return (
    <div className="content-shell py-8 md:py-12">
      <Suspense fallback={<CategoryPageSkeleton />}>
        <CategoryContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CategoryContent({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;

  let categories: Category[];
  try {
    categories = await getCategories();
  } catch (error) {
    return <LoadError error={error} retryHref={`/category/${slug}`} />;
  }
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();

  return (
    <>
      <h1 className="text-2xl font-black md:text-3xl">{category.name}</h1>
      <div className="mt-5 mb-8">
        <CategoryTabs categories={categories} current={category.slug} />
      </div>
      <Suspense fallback={<ProductGridSkeleton />}>
        <ProductListSection filter={{ categorySlug: category.slug }} basePath={`/category/${category.slug}`} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function CategoryPageSkeleton() {
  return (
    <>
      <Skeleton className="h-9 w-32" />
      <Skeleton className="mt-5 mb-8 h-10 w-full max-w-xl rounded-full" />
      <ProductGridSkeleton />
    </>
  );
}
