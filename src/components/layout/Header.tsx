import { TopBar } from "./TopBar";

// 메인 외 페이지 맨 위 흰색 한 줄 (가운데 로고). 메인은 (home) 레이아웃이 이 헤더를 쓰지 않고 배너 안 TopBar를 씀
export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur-lg">
      <TopBar />
    </header>
  );
}
