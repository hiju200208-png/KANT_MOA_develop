import type { CSSProperties } from "react";
import type { ArtistMember } from "@/types/app";
import { ProductImage } from "./ProductImage";

// 멤버 컬러는 데이터(artist_members.color)라 CSS 변수로만 넘깁니다. 없으면 아티스트 색 → 브랜드 색 순서로 대체
const memberColorStyle = (color: string | null) =>
  ({ "--member-color": color ?? "var(--artist-color, var(--brand))" }) as CSSProperties;

const formatBirthday = (birthday: string) => birthday.replaceAll("-", ".");

export function MemberCard({ member, artistName }: { member: ArtistMember; artistName: string }) {
  const details = [
    { label: "생일", value: member.birthday && formatBirthday(member.birthday) },
    { label: "MBTI", value: member.mbti },
    { label: "마스코트", value: member.mascot },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));

  return (
    <article style={memberColorStyle(member.color)} className="overflow-hidden rounded-lg bg-white shadow-card">
      <div className="relative">
        <ProductImage src={member.imageUrl} alt={`${artistName} ${member.name} 프로필 사진`} sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw" className="aspect-square" />
        <span className="absolute inset-x-0 bottom-0 h-1.5 bg-(--member-color)" aria-hidden="true" />
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-full bg-(--member-color)" aria-hidden="true" />
          <h3 className="text-lg font-black">{member.name}</h3>
          <span className="text-xs font-bold tracking-wide text-muted">{member.nameEn}</span>
        </div>
        {member.position && <p className="mt-0.5 text-sm font-semibold text-neutral-600">{member.position}</p>}
        {member.description && <p className="mt-3 text-sm leading-6 text-neutral-700">{member.description}</p>}
        {details.length > 0 && (
          <dl className="mt-4 space-y-1 border-t border-line pt-3 text-xs">
            {details.map((item) => (
              <div key={item.label} className="flex gap-2">
                <dt className="w-14 shrink-0 text-muted">{item.label}</dt>
                <dd className="font-semibold">{item.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {member.tags.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="태그">
            {member.tags.map((tag) => (
              <li key={tag} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">#{tag}</li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
