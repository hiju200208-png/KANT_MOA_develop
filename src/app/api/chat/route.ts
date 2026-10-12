// 칸트봇 API. Gemini API 키를 서버에만 두기 위한 유일한 Route Handler (SETUP.md 2장 예외)
import { askKantBot, type ChatTurn } from '@/lib/kantbot';

const MAX_MESSAGE = 500; // 질문 최대 길이
const MAX_HISTORY = 10; // 함께 보내는 이전 대화 수
const RATE_LIMIT = 10; // IP당 1분 요청 수

// ponytail: 서버 인스턴스 메모리 기준 제한이라 여러 인스턴스(Vercel)에선 느슨함. 남용되면 Upstash 등 외부 저장소로
const hits = new Map<string, number[]>();
function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

function parseBody(body: unknown): { message: string; history: ChatTurn[] } | null {
  if (!body || typeof body !== 'object') return null;
  const { message, history } = body as { message?: unknown; history?: unknown };
  if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE) return null;
  if (history !== undefined && !Array.isArray(history)) return null;
  const turns = (history ?? [])
    .filter((t): t is ChatTurn =>
      !!t && typeof t === 'object' && (t.role === 'user' || t.role === 'bot') && typeof t.text === 'string')
    .slice(-MAX_HISTORY)
    .map((t) => ({ role: t.role, text: t.text.slice(0, 1000) }));
  return { message: message.trim(), history: turns };
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'local';
  if (rateLimited(ip)) return Response.json({ error: 'RATE_LIMITED' }, { status: 429 });

  const input = parseBody(await request.json().catch(() => null));
  if (!input) return Response.json({ error: 'INVALID_INPUT' }, { status: 400 });

  try {
    const reply = await askKantBot(input.message, input.history);
    return Response.json({ reply });
  } catch (error) {
    console.error('[kantbot]', error);
    return Response.json({ error: 'AI_UNAVAILABLE' }, { status: 503 }); // 화면은 키워드 답변으로 대체
  }
}
