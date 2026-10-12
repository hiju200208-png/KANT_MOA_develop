// 에러 코드 표: docs/API_SPEC.md 6장. 코드 추가 시 BACKEND.md 7장, DB_DESIGN.md 7장도 함께 갱신

export const APP_ERROR_CODES = [
  'NOT_AUTHENTICATED',
  'CART_EMPTY',
  'UNAVAILABLE_ITEM',
  'PURCHASE_LIMIT_EXCEEDED',
  'OUT_OF_STOCK',
  'INVALID_ORDER',
  'ALREADY_CANCELLED',
  'INVALID_CREDENTIALS',
  'EMAIL_ALREADY_EXISTS',
  'WEAK_PASSWORD',
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number] | 'UNKNOWN';

export class AppError extends Error {
  constructor(
    public code: AppErrorCode,
    public detail?: string, // OUT_OF_STOCK, PURCHASE_LIMIT_EXCEEDED → 문제된 variantId
  ) {
    super(code);
  }
}

// RPC 에러: raise exception '<CODE>' using detail = '...' → error.message / error.details
export function toAppError(error: { message: string; details?: string | null }) {
  const code = (APP_ERROR_CODES as readonly string[]).includes(error.message)
    ? (error.message as AppErrorCode)
    : 'UNKNOWN';
  return new AppError(code, error.details ?? undefined);
}
