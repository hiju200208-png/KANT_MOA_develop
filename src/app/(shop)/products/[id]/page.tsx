import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatPrice } from "@/components/product/formatPrice";
import { LoadError } from "@/components/product/LoadError";
import { ProductImage } from "@/components/product/ProductImage";
import { ProductPurchasePanel } from "@/components/product/ProductPurchasePanel";
import { RecentlyViewedTracker } from "@/components/product/RecentlyViewedProducts";
import { Badge, Skeleton } from "@/components/ui";
import { getProduct } from "@/services/products";
import type { ProductDetail } from "@/types/app";

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export default function ProductPage({ params }: ProductPageProps) {
  return (
    <div className="content-shell py-6 md:py-12">
      <Suspense fallback={<ProductPageSkeleton />}>
        <ProductContent params={params} />
      </Suspense>
    </div>
  );
}

async function ProductContent({ params }: ProductPageProps) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) notFound();

  let product: ProductDetail | null;
  try {
    product = await getProduct(productId);
  } catch (error) {
    return <LoadError error={error} retryHref={`/products/${id}`} />;
  }
  if (!product) notFound();

  const altBase = `${product.artist.name} ${product.name}`;
  return (
    <>
      <RecentlyViewedTracker product={product} />
      <nav aria-label="현재 위치" className="mb-5 flex items-center gap-1.5 text-xs font-semibold text-muted">
        <Link href={`/artists/${product.artist.slug}`} className="brand-gradient-text-hover">{product.artist.name}</Link>
        <span aria-hidden="true">›</span>
        <Link href={`/category/${product.category.slug}`} className="brand-gradient-text-hover">{product.category.name}</Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductImage src={product.thumbnailUrl} alt={altBase} sizes="(min-width: 1024px) 50vw, 100vw" eager className="aspect-square rounded-lg" />

        <div>
          <Link href={`/artists/${product.artist.slug}`} className="brand-gradient-text-hover text-sm font-bold text-muted">
            {product.artist.name}
          </Link>
          <h1 className="mt-2 text-2xl font-black leading-snug md:text-3xl">{product.name}</h1>
          <div className="mt-3 flex items-center gap-3">
            <p className="text-2xl font-black">{formatPrice(product.price)}</p>
            {product.isSoldOut && <Badge className="bg-neutral-100 text-muted">품절</Badge>}
          </div>
          <div className="mt-8 border-t border-line pt-8">
            <ProductPurchasePanel product={product} />
          </div>
        </div>
      </div>

      <section aria-label="상품 정보" className="mx-auto mt-16 max-w-3xl">
        <h2 className="border-b border-line pb-4 text-lg font-black">상품 정보</h2>
        {product.description && <p className="mt-6 whitespace-pre-line text-sm leading-7 text-neutral-700">{product.description}</p>}
        {product.imageUrls.length > 0 && (
          <div className="mt-8 space-y-4">
            {product.imageUrls.map((url, index) => (
              <Image key={url} src={url} alt={`${altBase} 상세 이미지 ${index + 1}`} width={1200} height={1200} sizes="(min-width: 768px) 768px, 100vw" className="h-auto w-full rounded-md" />
            ))}
          </div>
        )}
        {!product.description && product.imageUrls.length === 0 && <p className="mt-6 text-sm text-muted">등록된 상세 정보가 없어요.</p>}
      </section>
    </>
  );
}

function ProductPageSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12" aria-busy="true" aria-label="상품 정보를 불러오는 중">
      <Skeleton className="aspect-square w-full rounded-lg" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-8 h-40 w-full" />
        <Skeleton className="h-13 w-full rounded-full" />
      </div>
    </div>
  );
}
