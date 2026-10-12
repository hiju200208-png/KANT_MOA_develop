// 칸트봇 AI 답변 (서버 /api/chat 호출). 실패하면 throw → 화면에서 키워드 답변으로 대체
export type ChatTurn = { role: 'user' | 'bot'; text: string };

export async function askKantBot(message: string, history: ChatTurn[]): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) throw new Error(`kantbot ${res.status}`);
  const { reply } = (await res.json()) as { reply: string };
  return reply;
}
