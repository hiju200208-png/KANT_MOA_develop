// 장바구니·주문·마이페이지의 페이지 제목. 상품 상세·카테고리 h1과 같은 크기(24px → md 30px)로 맞춘다.
export function PageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-black tracking-[-0.035em] md:text-3xl">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
    </div>
  );
}
