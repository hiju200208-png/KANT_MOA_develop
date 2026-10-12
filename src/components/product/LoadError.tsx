import { getErrorMessage } from "@/constants/error-messages";

interface LoadErrorProps {
  error: unknown;
  retryHref: string;
}

// 서버 컴포넌트에서 services 호출이 실패했을 때 보여주는 에러 상태 (새로고침으로 다시 시도)
export function LoadError({ error, retryHref }: LoadErrorProps) {
  return (
    <div role="alert" className="flex min-h-60 flex-col items-center justify-center rounded-lg bg-white px-6 text-center">
      <h2 className="text-lg font-black">정보를 불러오지 못했어요</h2>
      <p className="mt-2 text-sm text-muted">{getErrorMessage(error)}</p>
      <a href={retryHref} className="mt-6 inline-flex h-11 items-center rounded-full bg-foreground px-5 text-sm font-bold transition-colors hover:bg-neutral-800">
        <span className="text-white">다시 시도</span>
      </a>
    </div>
  );
}
