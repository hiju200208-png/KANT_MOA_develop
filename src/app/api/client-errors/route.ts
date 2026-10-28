// 화면 오류 수신(개발자용). 고객에게는 친절한 안내만 보여주고, 오류 내용은 여기서 서버 로그로만 남긴다.
// 로그 확인: 로컬은 `next dev` 터미널, 학원 서버는 Next.js 컨테이너 로그(docker logs)에서 "[client-error]"로 찾는다.

const MAX_BODY = 2_000; // 바이트
const RATE_LIMIT = 30; // IP당 1분 기록 수 (오류 폭주 시 로그가 넘치지 않게)
const hits = new Map<string, number[]>();

function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : null);
// 주소 뒤의 ?쿼리·#해시에는 토큰·개인정보가 들어갈 수 있어 경로만 남긴다 (보내는 쪽이 지켜도 서버에서 한 번 더 거른다)
const pathOnly = (value: unknown) => text(typeof value === 'string' ? value.split(/[?#]/)[0] : value, 200);

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const raw = await request.text().catch(() => '');
  if (!raw || raw.length > MAX_BODY || limited(ip)) return new Response(null, { status: 204 });
  try {
    const body = JSON.parse(raw) as Record<string, unknown>;
    console.error('[client-error]', {
      where: text(body.where, 40),
      path: pathOnly(body.path),
      message: text(body.message, 300),
      digest: text(body.digest, 60),
      at: text(body.at, 40),
      userAgent: request.headers.get('user-agent')?.slice(0, 160) ?? null,
    });
  } catch {
    // 형식이 틀린 보고는 버린다
  }
  return new Response(null, { status: 204 });
}
