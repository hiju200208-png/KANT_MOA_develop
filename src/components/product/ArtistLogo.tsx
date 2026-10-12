import Image from "next/image";
import type { Artist } from "@/types/app";
import { artistThemeStyle } from "./artistTheme";

// 아티스트 로고 타일. 로고 이미지가 없으면 테마 색 바탕에 이름 첫 글자를 보여줍니다.
export function ArtistLogo({ artist, size = "md" }: { artist: Artist; size?: "sm" | "md" }) {
  const box = size === "md" ? "size-16 rounded-2xl text-xl md:size-18" : "size-10 rounded-xl text-sm";
  return (
    <span style={artistThemeStyle(artist.themeColor)} className={`relative grid shrink-0 place-items-center overflow-hidden border border-line bg-(--artist-color) font-black ${box}`}>
      {artist.logoUrl ? (
        <Image src={artist.logoUrl} alt="" fill sizes="72px" className="object-cover" />
      ) : (
        <span className="text-white" aria-hidden="true">{artist.name.charAt(0)}</span>
      )}
    </span>
  );
}
