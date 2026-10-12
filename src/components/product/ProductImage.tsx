import Image from "next/image";

interface ProductImageProps {
  src: string | null;
  alt: string;
  sizes: string;
  eager?: boolean;
  className?: string;
}

export function ProductImage({ src, alt, sizes, eager = false, className = "" }: ProductImageProps) {
  return (
    <div className={`relative overflow-hidden bg-neutral-100 ${className}`}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} className="object-cover" />
      ) : (
        <div role="img" aria-label={`${alt} 이미지 준비 중`} className="grid size-full place-items-center text-xs font-semibold text-muted">
          이미지 준비 중
        </div>
      )}
    </div>
  );
}
