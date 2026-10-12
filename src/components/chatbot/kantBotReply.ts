// 칸트봇 답변. 지금은 키워드로 고른 고정 답변이고, AI API를 연동할 때 이 함수만 교체하면 된다.
// TODO(chatbot): AI API 연동 (대화 기록 history를 함께 보내 문맥 유지)

export type ChatMessage = { id: number; role: "bot" | "user"; text: string };

const REPLIES: { keywords: string[]; text: string }[] = [
  { keywords: ["배송", "언제", "도착"], text: "결제 완료 후 영업일 기준 2~5일 안에 출고돼요. 주문 상태는 마이페이지 > 주문/취소 내역에서 확인할 수 있어요." },
  { keywords: ["교환", "환불", "반품", "취소"], text: "결제 전 주문은 주문 상세에서 바로 취소할 수 있어요. 교환·반품은 상품 수령 후 7일 이내에 신청할 수 있어요." },
  { keywords: ["응원봉", "라이트"], text: "ORBIT:ON, DAYLOG, SODA FM 공식 응원봉이 있어요. 응원봉은 1인 2개까지 구매할 수 있어요." },
  { keywords: ["추천", "선물"], text: "처음이라면 멤버별로 고를 수 있는 키링이나 인형을 추천해요. 아티스트를 알려 주시면 더 골라 드릴게요!" },
  { keywords: ["재고", "품절"], text: "품절된 옵션은 상품 상세에서 선택할 수 없게 표시돼요. 재입고 소식은 공지로 알려 드릴게요." },
];

const FALLBACK = "아직 배우는 중이라 정확히 답하기 어려워요. 배송, 교환·환불, 상품 추천에 대해 물어봐 주세요!";

export async function getKantBotReply(message: string, history: ChatMessage[]): Promise<string> {
  void history; // API 연동 시 사용
  await new Promise((resolve) => setTimeout(resolve, 700)); // 답변을 기다리는 느낌을 주기 위한 지연
  const found = REPLIES.find(({ keywords }) => keywords.some((keyword) => message.includes(keyword)));
  return found?.text ?? FALLBACK;
}
