// 메인 배너에서 영상으로 보여줄 아티스트 (slug → 영상과 분위기 색).
// 영상이 있는 슬라이드는 상품 카드 대신 영상을 배너 전체(헤더 포함) 배경으로 깔고 "앨범 보러가기" 버튼을 보여준다.
// 영상을 불러오지 못하면 기존 파스텔 배너로 돌아간다.
// 영상 파일은 public/sources/에 있다. ⚠ 공식 뮤비 티저를 내려받은 파일이라 저작권이 소속사에 있다 (팀 시연용).
export interface HeroVideo {
  src: string;
  base: string; // 배너 바탕색 (rgb 채널, 예: "0 0 0"). ambient가 아니면 영상 가장자리도 이 색으로 녹인다
  ambient?: boolean; // true면 재생 중인 장면의 색을 흐리게 퍼뜨려 배경 그라데이션으로 쓴다 (장면 따라 색이 바뀜)
  title?: string; // 영상 배너에서만 쓸 제목 (없으면 아티스트 소개 문구)
  titleColor?: string; // 제목 글자색 (없으면 흰색)
  description?: string; // 제목 아래 설명 문단 (없으면 "앨범부터 응원봉, 한정 굿즈까지 한 곳에서")
  accent: string; // "아티스트 · OFFICIAL GOODS" 글자색
  cta: { background: string; color: string }; // "앨범 보러가기" 버튼
}

export const HERO_VIDEOS: Record<string, HeroVideo> = {
  // 어두운 연습실·밤거리 → 검정 그라데이션, 흰 버튼
  tws: {
    src: "/sources/tws.mp4",
    base: "0 0 0",
    accent: "rgb(255 255 255 / 0.9)",
    cta: { background: "#ffffff", color: "#111214" },
  },
  // REDRED 트레일러: 낡은 주방·뒷골목의 따뜻한 톤, 달력에 빨간 동그라미 → 검정 그라데이션에 빨간 글자, 아이보리 버튼에 빨간 글씨
  cortis: {
    src: "/sources/cortis.mp4",
    base: "0 0 0",
    accent: "#ff5a4e",
    cta: { background: "#f6efe2", color: "#d61f1f" },
  },
  // SPAGHETTI 티저: 빨간 의상, 핑크 네온, 다이너 → 검정 그라데이션에 핑크 글자, 레드 버튼
  "le-sserafim": {
    src: "/sources/le-sserafim.mp4",
    base: "0 0 0",
    accent: "#ffb3c1",
    cta: { background: "#e8263f", color: "#ffffff" },
  },
};
