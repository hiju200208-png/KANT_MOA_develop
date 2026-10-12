import type { AppErrorCode } from "@/services/errors";

export const ERROR_MESSAGES: Record<AppErrorCode, string> = {
  NOT_AUTHENTICATED: "로그인이 필요해요.",
  CART_EMPTY: "장바구니가 비어 있어요.",
  UNAVAILABLE_ITEM: "판매 중지되었거나 재고가 부족한 상품이 있어요. 장바구니를 확인해주세요.",
  PURCHASE_LIMIT_EXCEEDED: "옵션당 구매 가능 수량을 초과했어요.",
  OUT_OF_STOCK: "품절된 상품이 있어요.",
  INVALID_ORDER: "처리할 수 없는 주문이에요.",
  ALREADY_CANCELLED: "이미 취소된 주문이에요.",
  INVALID_CREDENTIALS: "이메일 또는 비밀번호가 올바르지 않아요.",
  EMAIL_ALREADY_EXISTS: "이미 가입된 이메일이에요.",
  WEAK_PASSWORD: "비밀번호 규칙을 확인해주세요.",
  UNKNOWN: "잠시 후 다시 시도해주세요.",
};

export function getErrorCode(error: unknown): AppErrorCode {
  const code = (error as { code?: string } | null)?.code;
  return code && code in ERROR_MESSAGES ? (code as AppErrorCode) : "UNKNOWN";
}

export function getErrorMessage(error: unknown): string {
  return ERROR_MESSAGES[getErrorCode(error)];
}
