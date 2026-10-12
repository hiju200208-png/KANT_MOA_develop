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
    <div className="content-shell pb-10 md:pt-5 md:pb-16">
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
      {/* 위버스샵 판매 페이지 기준: 이미지 58% · 정보 영역, 아티스트 14px 굵게 › 상품명 15px 회색 › 가격 20px */}
      <div className="-mx-4 grid md:mx-0 md:grid-cols-[58fr_42fr] md:gap-5">
        {/* 회색 박스 가운데에 상품 이미지를 띄움 (위버스샵 판매 페이지 참고) */}
        <div className="grid aspect-square place-items-center bg-[#f6f6f6] md:rounded-[8px]">
          <ProductImage src={product.thumbnailUrl} alt={altBase} sizes="(min-width: 768px) 35vw, 60vw" eager className="aspect-square w-[60%] rounded-[16px] shadow-[0_8px_24px_rgb(0_0_0/0.08)]" />
        </div>

        <div className="min-w-0 px-4 pt-5 pb-5 md:px-0 md:pt-4">
          <Link href={`/artists/${product.artist.slug}`} className="inline-flex items-center gap-0.5 text-sm leading-[18px] font-bold text-black hover:underline">
            {product.artist.name}
            <span aria-hidden="true">›</span>
          </Link>
          <h1 className="mt-1.5 mb-1 text-[15px] leading-[21px] font-normal break-all text-[#484848]">{product.name}</h1>
          <div className="mt-3 flex items-center gap-2">
            <p className="text-xl leading-[26px] font-extrabold text-black">{formatPrice(product.price)}</p>
            {product.isSoldOut && <Badge className="bg-neutral-100 text-muted">품절</Badge>}
          </div>
          <div className="mt-5">
            <ProductPurchasePanel product={product} />
          </div>
        </div>
      </div>

      <section aria-labelledby="product-info-tab" className="mt-2 md:mt-0">
        {/* 탭 모양 제목 (위버스샵 상세정보 탭: 높이 44px, 14px 굵게, 아래 3px 선) */}
        <div className="border-b border-black/10">
          <h2 id="product-info-tab" className="mx-auto flex h-11 w-fit items-center border-b-[3px] border-black px-6 text-sm font-bold">상세정보</h2>
        </div>
        <div className="mx-auto max-w-3xl">
        {product.description && <p className="mt-5 whitespace-pre-line text-[13px] leading-[17px] text-[#484848]">{product.description}</p>}
        {product.imageUrls.length > 0 && (
          <div className="mt-5">
            {product.imageUrls.map((url, index) => (
              <Image key={url} src={url} alt={`${altBase} 상세 이미지 ${index + 1}`} width={1200} height={1200} sizes="(min-width: 768px) 768px, 100vw" className="h-auto w-full" />
            ))}
          </div>
        )}
        {!product.description && product.imageUrls.length === 0 && <p className="mt-5 text-[13px] text-muted">등록된 상세 정보가 없어요.</p>}
        </div>
      </section>
    </>
  );
}

function ProductPageSkeleton() {
  return (
    <div className="grid gap-5 md:grid-cols-[58fr_42fr]" aria-busy="true" aria-label="상품 정보를 불러오는 중">
      <Skeleton className="aspect-square w-full rounded-[8px]" />
      <div className="space-y-3 md:pt-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-6 w-28" />
        <Skeleton className="mt-5 h-28 w-full rounded-[8px]" />
        <Skeleton className="h-11 w-full rounded-[8px]" />
      </div>
    </div>
  );
}
