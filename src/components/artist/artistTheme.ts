import type { CSSProperties } from "react";

// 아티스트 테마 색은 데이터(artists.theme_color)라서 Tailwind 클래스로 만들 수 없어 CSS 변수로만 넘깁니다.
// 값이 없으면 브랜드 색으로 대체합니다.
export function artistThemeStyle(themeColor: string | null): CSSProperties {
  return { "--artist-color": themeColor ?? "var(--brand)" } as CSSProperties;
}
