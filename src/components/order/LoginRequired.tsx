import Link from "next/link";
import { Button, EmptyState } from "@/components/ui";

interface LoginRequiredProps {
  /** 로그인 후 돌아올 경로 */
  next: string;
  description?: string;
}

export function LoginRequired({ next, description }: LoginRequiredProps) {
  return (
    <EmptyState
      title="로그인이 필요해요"
      description={description}
      action={<Link href={`/login?next=${encodeURIComponent(next)}`}><Button>로그인하기</Button></Link>}
    />
  );
}
