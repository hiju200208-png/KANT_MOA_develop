"use client";

import Image from "next/image";
import { useRef, useState, type CSSProperties } from "react";
import type { ArtistMember } from "@/types/app";

const formatBirthday = (birthday: string) => birthday.replaceAll("-", ".");

// 멤버 소개 (BELIFT LAB 아티스트 프로필 참고): 세로로 긴 사진이 지그재그로 엇갈리고, 검은 이름표가 사진 아래에 겹친다.
// 카드를 누르면 상세 팝업(포지션·한 줄 소개·생일·MBTI·마스코트·태그)이 열린다.
export function MemberGallery({ members, artistName }: { members: ArtistMember[]; artistName: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<ArtistMember | null>(null);

  function open(member: ArtistMember) {
    setSelected(member);
    dialogRef.current?.showModal();
  }

  const details = selected
    ? [
        { label: "생일", value: selected.birthday && formatBirthday(selected.birthday) },
        { label: "MBTI", value: selected.mbti },
        { label: "마스코트", value: selected.mascot },
      ].filter((item): item is { label: string; value: string } => Boolean(item.value))
    : [];

  return (
    <>
      <ul className="flex flex-wrap justify-center gap-x-6 gap-y-16 sm:gap-x-16 sm:gap-y-20">
        {members.map((member, index) => (
          <li key={member.id} className={`reveal w-[150px] sm:w-[250px] ${index % 2 === 1 ? "mt-14 sm:mt-20" : ""}`}>
            <button
              type="button"
              onClick={() => open(member)}
              aria-haspopup="dialog"
              aria-label={`${member.name} 프로필 보기`}
              className="group relative block w-full cursor-pointer pb-8 text-left sm:pb-10"
            >
              <span className="relative block aspect-1/2 w-full overflow-hidden bg-neutral-100">
                {member.imageUrl ? (
                  <Image
                    src={member.imageUrl}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 250px, 150px"
                    className="object-cover object-[center_30%] transition-transform duration-700 ease-out group-hover:scale-[1.06] group-focus-visible:scale-[1.06] motion-reduce:transition-none"
                  />
                ) : (
                  <span className="grid size-full place-items-center text-xs font-semibold text-muted">사진 준비 중</span>
                )}
              </span>
              <span className="absolute bottom-0 left-4 flex w-full min-h-[72px] flex-col justify-center gap-1 bg-black px-4 py-3 sm:left-[30px] sm:min-h-[103px] sm:px-6 sm:py-5">
                <span className="text-xl leading-tight font-bold text-[#c9c9c9] transition-colors group-hover:text-white group-focus-visible:text-white sm:text-[28px]">{member.name}</span>
                {member.birthday && <span className="text-xs text-[#8a8a8a] sm:text-sm">{formatBirthday(member.birthday)}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        aria-labelledby="member-dialog-name"
        onClick={(event) => event.target === event.currentTarget && dialogRef.current?.close()}
        className="m-auto w-[min(880px,calc(100%-32px))] overflow-hidden rounded-2xl p-0 backdrop:bg-black/55"
      >
        {selected && (
          <div
            style={{ "--member-color": selected.color ?? "var(--artist-color, var(--brand))" } as CSSProperties}
            className="grid md:grid-cols-[1fr_1.1fr]"
          >
            <span className="relative block aspect-square bg-neutral-100 md:aspect-3/4">
              {selected.imageUrl && <Image src={selected.imageUrl} alt={`${artistName} ${selected.name} 프로필 사진`} fill sizes="(min-width: 768px) 420px, 100vw" className="object-cover" />}
            </span>
            <div className="relative p-6 md:p-9">
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                aria-label="닫기"
                className="absolute top-4 right-4 grid size-11 place-items-center rounded-full border border-line bg-white text-xl"
              >
                ×
              </button>
              {selected.nameEn && <p className="text-sm tracking-[0.14em] text-muted">{selected.nameEn}</p>}
              <h3 id="member-dialog-name" className="mt-1 flex items-center gap-3 text-3xl font-black md:text-4xl">
                <span aria-hidden="true" className="size-3.5 rounded-full bg-(--member-color)" />
                {selected.name}
              </h3>
              {selected.position && <p className="mt-1 font-bold text-sky-700">{selected.position}</p>}
              {selected.description && (
                <blockquote className="my-6 border-l-[3px] border-(--member-color) bg-neutral-50 px-5 py-4 leading-7">{selected.description}</blockquote>
              )}
              {details.length > 0 && (
                <dl className="grid grid-cols-[80px_1fr] gap-x-4 gap-y-3 text-[15px]">
                  {details.map((item) => (
                    <div key={item.label} className="contents">
                      <dt className="text-muted">{item.label}</dt>
                      <dd className="font-semibold">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {selected.tags.length > 0 && (
                <ul className="mt-6 flex flex-wrap gap-2" aria-label="태그">
                  {selected.tags.map((tag) => (
                    <li key={tag} className="rounded-full bg-sky-50 px-3 py-1.5 text-[13px] font-semibold text-sky-900">#{tag}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
