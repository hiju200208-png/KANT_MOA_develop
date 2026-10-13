// 장바구니·주문·마이페이지의 페이지 제목 (모바일 text-xl → md 30px)
export function PageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-xl font-black tracking-[-0.035em] md:text-3xl">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
    </div>
  );
}
