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
      <div className="relative overflow-hidden rounded-md transition-shadow duration-300 group-hover:shadow-[0_18px_36px_-14px_rgb(17_18_20/0.35)] group-focus-visible:shadow-[0_18px_36px_-14px_rgb(17_18_20/0.35)]">
        <ProductImage
          src={product.thumbnailUrl}
          alt={`${product.artist.name} ${product.name}`}
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="aspect-square rounded-md [&_img]:transition-[scale] [&_img]:duration-500 [&_img]:ease-out group-hover:[&_img]:scale-[1.07] group-focus-visible:[&_img]:scale-[1.07] motion-reduce:[&_img]:transition-none"
        />
        {product.isSoldOut && (
          <span className="absolute inset-0 grid place-items-center rounded-md bg-black/45 text-sm font-black text-white">품절</span>
        )}
      </div>
      <p className="mt-3 text-xs font-bold text-muted">{product.artist.name}</p>
      <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-5">{product.name}</h3>
      <p className="mt-1.5 text-base font-black">{formatPrice(product.price)}</p>
    </Link>
  );
}
