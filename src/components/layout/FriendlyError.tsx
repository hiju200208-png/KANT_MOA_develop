import Link from "next/link";

// 고객용 오류 안내. 상태 코드·오류 메시지·스택은 보여주지 않는다 (내용은 reportClientError로 개발자에게).
export function FriendlyError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="content-shell flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <span aria-hidden="true" className="grid size-16 place-items-center rounded-full bg-neutral-100 text-3xl">
        🛠️
      </span>
      <h1 className="mt-5 text-2xl font-black tracking-[-0.035em] md:text-3xl">잠시 문제가 생겼어요</h1>
      <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
        화면을 불러오는 중에 문제가 생겼어요.
        <br />
        잠시 후 다시 시도해 주세요. 문제는 바로 확인할게요.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-12 items-center rounded-full bg-foreground px-6 text-sm font-bold text-white transition-colors hover:bg-neutral-800"
          >
            다시 시도
          </button>
        )}
        <Link href="/products" className="brand-gradient-soft-hover inline-flex h-12 items-center rounded-full border border-line bg-white px-6 text-sm font-bold">
          전체 상품 보기
        </Link>
      </div>
    </div>
  );
}
