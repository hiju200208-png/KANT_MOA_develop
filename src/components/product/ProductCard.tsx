import Link from "next/link";
import type { ProductSummary } from "@/types/app";
import { formatPrice } from "./formatPrice";
import { ProductImage } from "./ProductImage";

// 마우스를 올리면 카드가 살짝 뜨고 이미지가 확대된다 (터치 기기는 hover 없음)
export function ProductCard({ product }: { product: ProductSummary }) {
  return (
    <Link
      href={`/products/${product.id}`}
      className="group block transition-transform duration-300 ease-out hover:-translate-y-1 focus-visible:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="relative overflow-hidden rounded-md">
        <ProductImage
          src={product.thumbnailUrl}
          alt={`${product.artist.name} ${product.name}`}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="aspect-square rounded-md [&_img]:transition-[scale] [&_img]:duration-500 [&_img]:ease-out group-hover:[&_img]:scale-[1.07] group-focus-visible:[&_img]:scale-[1.07] motion-reduce:[&_img]:transition-none"
        />
        {product.isSoldOut && (
          <span className="absolute inset-0 grid place-items-center rounded-md bg-[rgb(247_247_247/0.78)] text-base font-bold text-[#666]">품절</span>
        )}
      </div>
      {/* 캡션: 위버스샵 상품 카드 figcaption 기준 (여백 8px 4px 0, 13px/17px, 이름 굵게 검정 · 보조 텍스트 #484848) */}
      <div className="px-1 pt-2">
        <h3 className="mb-0.5 line-clamp-2 text-[13px] leading-[17px] font-bold text-black">{product.name}</h3>
        <p className="truncate text-[13px] leading-[17px] text-[#484848]">{product.artist.name}</p>
        <p className="mt-1 text-sm font-bold text-black">{formatPrice(product.price)}</p>
      </div>
    </Link>
  );
}
