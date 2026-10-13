import type { BestProduct } from "@/types/app";

// 메인 배너 소제목: 지금 배너에 오른 대표 상품(아티스트별 최근 7일 판매 1위)에 맞춘 문구.
// 상품 id별 문구가 없으면(순위가 바뀌어 새 상품이 오르면) 카테고리별 문구로 대신한다.
const BY_PRODUCT: Record<number, string> = {
  751: "‘HOME’의 문을 여는 첫 정규 앨범, 포켓 버전 세트로 간직해 보세요.", // BOYNEXTDOOR 1st Studio Album HOME (POCKET HOME Ver. 세트)
  27: "다섯 행성을 하나로 이은 팔찌, 손목 위에 ORBIT:ON의 궤도를 그려 보세요.", // ORBIT:ON 행성 팔찌
  14: "부드러운 핑크빛 데일리 후드티로 평범한 하루를 DAYLOG답게.", // DAYLOG 데일리 후드티
  21: "후드티부터 바시티 자켓까지, SODAFM의 청량함을 입는 아우터 컬렉션.", // SODAFM 아우터 컬렉션
  159: "ZICO의 세 번째 정규 앨범, 상자를 여는 순간부터 무대가 시작돼요.", // ZICO 3집 앨범
  259: "BTS BABY 캐릭터를 담은 클로젯 세트, 곁에 두고 매일 함께하세요.", // BTS BABY 23 클로젯 세트
  479: "CARAT을 위한 멤버십 키트로 열세 명과 한 팀이 되는 첫걸음.", // SEVENTEEN CARAT 멤버십 키트
  669: "MOA를 위한 멤버십 키트와 함께 꿈의 다음 장을 넘겨 보세요.", // TOMORROW X TOGETHER MOA 멤버십 키트
};

const BY_CATEGORY: Record<string, (artist: string) => string> = {
  album: (artist) => `${artist}의 음악을 가장 가까이 소장하는 방법, 앨범으로 만나보세요.`,
  cheering: (artist) => `공연장에서 ${artist}와 하나 되는 순간을 함께할 응원용품.`,
  doll: (artist) => `${artist}를 닮은 인형, 곁에 두고 매일 함께하세요.`,
  accessory: (artist) => `매일 지니고 다니는 작은 ${artist}, 액세서리로 포인트를 더해 보세요.`,
  apparel: (artist) => `일상에서도 ${artist}와 함께, 편하게 입는 공식 의류.`,
  living: (artist) => `하루의 작은 순간까지 ${artist}로 채우는 생활용품.`,
  membership: (artist) => `${artist} 팬클럽 멤버십 키트로 가장 먼저 소식을 받아 보세요.`,
};

const FALLBACK = "앨범부터 응원봉, 한정 굿즈까지 한 곳에서";

export function heroSubtitle(artistName: string, product: BestProduct | undefined) {
  if (!product) return FALLBACK;
  return BY_PRODUCT[product.id] ?? BY_CATEGORY[product.category.slug]?.(artistName) ?? FALLBACK;
}
