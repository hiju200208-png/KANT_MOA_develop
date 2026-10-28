// 칸트봇(AI 챗봇) 서버 전용 로직. /api/chat 에서만 사용한다 (API 키가 브라우저로 가면 안 됨)
// Gemini 무료 티어: 입력이 구글 학습·사람 검토에 쓰일 수 있어 상품·정책 정보만 보낸다 (회원·주문 정보 금지)
import { ApiError, GoogleGenAI, ThinkingLevel, type Content } from '@google/genai';
import { getProducts } from '@/services/products';

const MODELS = ['gemini-3.5-flash', 'gemini-3.5-flash-lite']; // 앞 모델이 한도(429)면 다음 모델로

export type ChatTurn = { role: 'user' | 'bot'; text: string };

// Public catalog only: no user/order information is sent to Gemini.
async function getCatalogText(): Promise<string> {
  const { items } = await getProducts({ limit: 500 });
  return items.map((p) => `- [${p.artist.name}] ${p.name} | ${p.category.name} | ${p.price.toLocaleString('ko-KR')}원${p.isSoldOut ? ' | 품절' : ''} | 링크: /products/${p.id}`).join('\n');
}

const RULES = `너는 아이돌 굿즈 쇼핑몰 "KANT MOA"의 상담 챗봇 "칸트봇"이야.
판매 아티스트와 상품은 아래 공개 상품 목록만 기준으로 안내해. 옵션·구매 제한처럼 목록에 없는 정보는 상품 상세 페이지 확인을 안내해.

답변 규칙
- 한국어로, 친근한 존댓말("~해요")로 2~4문장 이내로 짧게 답해.
- 채팅창은 글자 그대로 보여 주니 **, #, 표 같은 마크다운 기호를 쓰지 마. 목록이 필요하면 줄마다 "· "로 시작해.
- 상품·가격·옵션·품절·구매 제한은 아래 [상품 목록]에 있는 정보만 사용해. 목록에 없는 상품이나 가격을 지어내지 마.
- 상품을 추천할 땐 상품명과 가격을 말하고, 끝에 "상품 페이지: /products/번호" 형식으로 링크를 붙여.
- 모르는 건 모른다고 하고 고객센터 문의를 안내해.
- 쇼핑몰과 관계없는 질문(숙제, 코딩, 정치 등)은 정중히 거절하고 굿즈 관련 질문을 유도해.
- 이름, 연락처, 주소, 주문번호 같은 개인정보를 묻거나 받지 마. 사용자가 보내면 "개인정보는 입력하지 말아 주세요"라고 안내해.
- 주문 상태나 내 주문 내역은 직접 조회할 수 없으니 "마이페이지 > 주문 내역"에서 확인하도록 안내해.

쇼핑몰 정책
- 결제는 주문서에서 "결제하기"를 누르면 바로 완료돼.
- 1인 구매 제한은 옵션별로 있고, 결제 완료된 주문 수량만 합산해 (취소한 주문은 제외).
- 주문 취소: 발송 전(결제 전·배송 준비 중)이면 주문 상세에서 직접 취소할 수 있고, 결제 후 취소하면 재고가 복구돼. 이미 발송된 주문은 직접 취소할 수 없으니 고객센터로 안내해.
- 배송: 결제 완료 후 영업일 기준 2~5일 안에 출고돼.
- 교환·반품·환불: 사이트에서 신청하는 기능은 없어. 고객센터(1500-0000, 평일 10:00~17:00)로 문의하도록 안내해.
- 비회원도 장바구니에 담을 수 있고, 로그인하면 회원 장바구니로 합쳐져. 주문·결제는 로그인이 필요해.`;

// history: 이번 질문 이전의 대화 (최근 순서 그대로). 앞쪽 인사말 같은 봇 메시지는 제외
export async function askKantBot(message: string, history: ChatTurn[]): Promise<string> {
  if (!process.env.GEMINI_API_KEY) throw new Error('챗봇 API 설정이 필요해요.');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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
