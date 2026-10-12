// 칸트봇(AI 챗봇) 서버 전용 로직. /api/chat 에서만 사용한다 (API 키가 브라우저로 가면 안 됨)
// Gemini 무료 티어: 입력이 구글 학습·사람 검토에 쓰일 수 있어 상품·정책 정보만 보낸다 (회원·주문 정보 금지)
import { ApiError, GoogleGenAI, ThinkingLevel, type Content } from '@google/genai';
import { publicClient as db } from '@/lib/supabase/client';

const MODELS = ['gemini-3.5-flash', 'gemini-3.5-flash-lite']; // 앞 모델이 한도(429)면 다음 모델로
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export type ChatTurn = { role: 'user' | 'bot'; text: string };

// 상품 목록은 자주 안 바뀌어서 5분 동안 재사용 (요청마다 DB 조회 방지)
const CATALOG_TTL = 5 * 60 * 1000;
let catalogCache: { text: string; at: number } | null = null;

async function getCatalogText(): Promise<string> {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL) return catalogCache.text;
  const { data, error } = await db
    .from('products')
    .select('id, name, price, status, description, artists(name), categories(name), product_variants(option_name, extra_price, stock, max_per_user, sort_order)')
    .order('id');
  if (error) throw error;

  const lines = data.map((p) => {
    const variants = [...p.product_variants].sort((a, b) => a.sort_order - b.sort_order);
    const soldOut = p.status === 'sold_out' || variants.every((v) => v.stock === 0);
    const options = variants
      .map((v) => `${v.option_name}${v.extra_price ? `(+${v.extra_price}원)` : ''}${v.stock === 0 ? '[품절]' : ''}${v.max_per_user ? `[1인 ${v.max_per_user}개]` : ''}`)
      .join(', ');
    return `- [${p.artists?.name}] ${p.name} | ${p.categories?.name} | ${p.price.toLocaleString('ko-KR')}원${soldOut ? ' | 품절' : ''} | 옵션: ${options} | 링크: /products/${p.id} | ${p.description ?? ''}`;
  });
  catalogCache = { text: lines.join('\n'), at: Date.now() };
  return catalogCache.text;
}

const RULES = `너는 아이돌 굿즈 쇼핑몰 "KANT MOA"의 상담 챗봇 "칸트봇"이야.
판매 아티스트: ORBIT:ON(오르빗온, 5인조 보이그룹), DAYLOG(데이로그, 4인조 걸그룹), SODAFM(소다에프엠, 4인조 보이그룹). 모두 가상의 그룹이야.

답변 규칙
- 한국어로, 친근한 존댓말("~해요")로 2~4문장 이내로 짧게 답해.
- 상품·가격·옵션·품절·구매 제한은 아래 [상품 목록]에 있는 정보만 사용해. 목록에 없는 상품이나 가격을 지어내지 마.
- 상품을 추천할 땐 상품명과 가격을 말하고, 끝에 "상품 페이지: /products/번호" 형식으로 링크를 붙여.
- 모르는 건 모른다고 하고 고객센터 문의를 안내해.
- 쇼핑몰과 관계없는 질문(숙제, 코딩, 정치 등)은 정중히 거절하고 굿즈 관련 질문을 유도해.
- 이름, 연락처, 주소, 주문번호 같은 개인정보를 묻거나 받지 마. 사용자가 보내면 "개인정보는 입력하지 말아 주세요"라고 안내해.
- 주문 상태나 내 주문 내역은 직접 조회할 수 없으니 "마이페이지 > 주문 내역"에서 확인하도록 안내해.

쇼핑몰 정책
- 결제는 주문서에서 "결제하기"를 누르면 바로 완료돼.
- 1인 구매 제한은 옵션별로 있고, 결제 완료된 주문 수량만 합산해 (취소한 주문은 제외).
- 주문 취소: 주문 상세에서 직접 취소할 수 있어. 결제 전이든 결제 후든 취소 가능하고, 결제 후 취소하면 재고가 복구돼.
- 배송: 결제 완료 후 영업일 기준 2~5일 안에 출고돼.
- 교환·반품: 상품 수령 후 7일 이내에 신청할 수 있어.
- 비회원도 장바구니에 담을 수 있고, 로그인하면 회원 장바구니로 합쳐져. 주문·결제는 로그인이 필요해.`;

// history: 이번 질문 이전의 대화 (최근 순서 그대로). 앞쪽 인사말 같은 봇 메시지는 제외
export async function askKantBot(message: string, history: ChatTurn[]): Promise<string> {
  const catalog = await getCatalogText();
  const firstUser = history.findIndex((t) => t.role === 'user');
  const turns = firstUser === -1 ? [] : history.slice(firstUser);
  const contents: Content[] = [
    ...turns.map((t) => ({ role: t.role === 'user' ? 'user' : 'model', parts: [{ text: t.text }] })),
    { role: 'user', parts: [{ text: message }] },
  ];

  for (const [i, model] of MODELS.entries()) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: `${RULES}\n\n[상품 목록]\n${catalog}`,
          maxOutputTokens: 1024,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      const text = res.text?.trim();
      if (text) return text;
      throw new Error(`빈 응답 (${model}, finishReason: ${res.candidates?.[0]?.finishReason})`);
    } catch (e) {
      const last = i === MODELS.length - 1;
      if (!last && e instanceof ApiError && e.status === 429) continue; // 한도 초과 → 다음 모델
      throw e;
    }
  }
  throw new Error('unreachable');
}
