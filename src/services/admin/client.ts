// 관리자 API 호출 공통 부분: FastAPI 주소, 토큰, {code, message} 오류 처리
// - API 주소: NEXT_PUBLIC_API_URL (없으면 로컬 http://localhost:8000)
// - 토큰: P1(희주님) 로그인 프론트가 정해지면 getAdminAccessToken 한 곳만 바꾼다.

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export class AdminApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

// TODO(P1 연동): 로그인 후 받은 access token을 돌려주도록 교체
export const ADMIN_TOKEN_STORAGE_KEY = "kantmoa.accessToken";
export function getAdminAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const token = getAdminAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers, cache: "no-store" });
  } catch {
    throw new AdminApiError(0, "UNKNOWN", "서버에 연결할 수 없어요. 백엔드가 실행 중인지 확인해주세요.");
  }
  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof data?.message === "string" ? data.message : "잠시 후 다시 시도해주세요.";
    throw new AdminApiError(response.status, typeof data?.code === "string" ? data.code : "UNKNOWN", message);
  }
  return data as T;
}

export function adminErrorMessage(error: unknown): string {
  if (error instanceof AdminApiError) return error.message;
  return "잠시 후 다시 시도해주세요.";
}

// 서버가 주는 /static/..., /uploads/... 상대 경로를 API 주소와 합친다
export function apiAssetUrl(path: string | null): string | null {
  if (!path) return null;
  return /^https?:\/\//.test(path) ? path : `${API_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}
