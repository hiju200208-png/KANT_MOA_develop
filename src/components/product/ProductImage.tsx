import Image from "next/image";

interface ProductImageProps {
  src: string | null;
  alt: string;
  sizes: string;
  eager?: boolean;
  className?: string;
  // 회색 박스 안에 여백을 두고 상품을 띄움 (누끼 이미지용, 예: "12%"). 사진도 같은 크기로 줄어 들어감
  inset?: string;
}

export function ProductImage({ src, alt, sizes, eager = false, className = "", inset }: ProductImageProps) {
  const image = src && (
    <Image src={src} alt={alt} fill sizes={sizes} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} className={inset ? "object-contain" : "object-cover"} />
  );
  return (
    <div className={`relative overflow-hidden ${inset ? "bg-[#ededed]" : "bg-neutral-100"} ${className}`}>
      {image && inset ? (
        <div className="absolute overflow-hidden rounded-[8px]" style={{ inset }}>{image}</div>
      ) : image ? (
        image
      ) : (
        <div role="img" aria-label={`${alt} 이미지 준비 중`} className="grid size-full place-items-center text-xs font-semibold text-muted">
          이미지 준비 중
        </div>
      )}
    </div>
  );
}
