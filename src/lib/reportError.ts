// 화면 오류를 개발자에게 보낸다. 고객 화면에는 코드·스택을 보여주지 않고, 내용은 서버 로그(/api/client-errors)로만 남긴다.
// 개인정보가 섞이지 않게 주소의 쿼리(?검색어 등)는 빼고, 메시지는 길이를 자른다.

const sent = new Set<string>();

export function reportClientError(error: Error & { digest?: string }, where: string) {
  if (typeof window === 'undefined') return;
  const payload = {
    where,
    message: String(error?.message ?? '').slice(0, 300),
    digest: error?.digest ?? null, // 서버 렌더 오류면 서버 로그와 맞춰 볼 수 있는 번호
    path: window.location.pathname,
    at: new Date().toISOString(),
  };
  const key = `${payload.where}|${payload.path}|${payload.message}`;
  if (sent.has(key)) return; // 같은 오류를 반복해서 보내지 않는다
  sent.add(key);

  const body = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon?.('/api/client-errors', new Blob([body], { type: 'application/json' }))) return;
  } catch {
    // sendBeacon이 막힌 브라우저는 아래 fetch로
  }
  fetch('/api/client-errors', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
}
