// 칸트봇 답변. AI(Gemini, /api/chat)로 답하고, 실패하면(한도 초과·장애) 아래 키워드 고정 답변으로 대체한다.
import { askKantBot } from "@/services/chat";

export type ChatMessage = { id: number; role: "bot" | "user"; text: string };

const REPLIES: { keywords: string[]; text: string }[] = [
  { keywords: ["배송", "언제", "도착"], text: "결제 완료 후 영업일 기준 2~5일 안에 출고돼요. 주문 상태는 마이페이지 > 주문/취소 내역에서 확인할 수 있어요." },
  { keywords: ["교환", "환불", "반품", "취소"], text: "결제 전 주문은 주문 상세에서 바로 취소할 수 있어요. 교환·반품은 상품 수령 후 7일 이내에 신청할 수 있어요." },
  { keywords: ["응원봉", "라이트"], text: "ORBIT:ON, DAYLOG, SODA FM 공식 응원봉이 있어요. 응원봉은 1인 2개까지 구매할 수 있어요." },
  { keywords: ["추천", "선물"], text: "처음이라면 멤버별로 고를 수 있는 키링이나 인형을 추천해요. 아티스트를 알려 주시면 더 골라 드릴게요!" },
  { keywords: ["재고", "품절"], text: "품절된 옵션은 상품 상세에서 선택할 수 없게 표시돼요. 재입고 소식은 공지로 알려 드릴게요." },
];

const FALLBACK = "아직 배우는 중이라 정확히 답하기 어려워요. 배송, 교환·환불, 상품 추천에 대해 물어봐 주세요!";

// history: 이번 질문까지 포함한 전체 대화 (KantBot.send 기준)
export async function getKantBotReply(message: string, history: ChatMessage[]): Promise<string> {
  try {
    const previous = history.slice(0, -1).map(({ role, text }) => ({ role, text }));
    return await askKantBot(message, previous);
  } catch {
    return keywordReply(message);
  }
}

function keywordReply(message: string): string {
  const found = REPLIES.find(({ keywords }) => keywords.some((keyword) => message.includes(keyword)));
  return found?.text ?? FALLBACK;
}
