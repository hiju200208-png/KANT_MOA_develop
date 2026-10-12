import { TopBar } from "./TopBar";

// 모든 페이지 맨 위 한 줄 (가운데 로고). 메인은 배너 안에 같은 TopBar가 있어서 숨김 (배너에 data-home 표시, CSS로만 처리)
export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur-lg [&:has(~main_[data-home])]:hidden">
      <TopBar />
    </header>
  );
}
