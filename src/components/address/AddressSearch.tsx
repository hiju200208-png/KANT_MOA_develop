"use client";

import { useEffect, useRef, useState } from "react";

// 카카오(다음) 우편번호 서비스. 무료이고 API 키가 필요 없다. https://postcode.map.daum.net/guide
const SCRIPT_URL = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

type PostcodeData = {
  zonecode: string; // 새 우편번호 5자리
  roadAddress: string;
  jibunAddress: string;
  userSelectedType: "R" | "J";
  bname: string; // 법정동
  buildingName: string;
  apartment: "Y" | "N";
};

type PostcodeConstructor = new (options: {
  oncomplete: (data: PostcodeData) => void;
  width: string;
  height: string;
  theme?: Record<string, string>;
}) => { embed: (element: HTMLElement, options?: { autoClose?: boolean }) => void };

declare global {
  interface Window {
    daum?: { Postcode: PostcodeConstructor };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadPostcodeScript(): Promise<void> {
  if (window.daum?.Postcode) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null; // 다음에 다시 시도할 수 있게
      reject(new Error("postcode script failed"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

// 도로명 주소 + (동, 건물명) 참고항목. 카카오 가이드의 권장 조합 방식
function toAddress(data: PostcodeData): string {
  if (data.userSelectedType === "J") return data.jibunAddress;
  const extras = [/[동로가]$/.test(data.bname) ? data.bname : "", data.apartment === "Y" ? data.buildingName : ""].filter(Boolean);
  return extras.length > 0 ? `${data.roadAddress} (${extras.join(", ")})` : data.roadAddress;
}

interface AddressSearchProps {
  onSelect: (result: { postalCode: string; address1: string }) => void;
  onClose: () => void;
}

/** 입력칸 아래에 펼쳐지는 도로명 주소 검색 창. 고르면 우편번호와 기본 주소를 채운다. */
export function AddressSearch({ onSelect, onClose }: AddressSearchProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  // 검색 창은 한 번만 만들고, 고를 때는 항상 최신 onSelect를 부른다
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let active = true;
    loadPostcodeScript()
      .then(() => {
        if (!active || !containerRef.current || !window.daum) return;
        new window.daum.Postcode({
          oncomplete: (data) => onSelectRef.current({ postalCode: data.zonecode, address1: toAddress(data) }),
          width: "100%",
          height: "100%",
          // 검색창은 흰 배경 + 진한 글자 (사이트 입력칸과 같은 톤)
          theme: { searchBgColor: "#FFFFFF", queryTextColor: "#111214", outlineColor: "#E8E9EB", emphTextColor: "#00A992" },
        }).embed(containerRef.current, { autoClose: false });
        setReady(true);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-md border border-line">
      <div className="flex items-center justify-between border-b border-line bg-neutral-50 px-4 py-2.5">
        <p className="text-sm font-bold">도로명 주소 검색</p>
        <button type="button" onClick={onClose} aria-label="주소 검색 닫기" className="grid size-8 place-items-center rounded-full text-lg text-muted hover:bg-neutral-200">×</button>
      </div>
      {failed ? (
        <p role="alert" className="px-4 py-8 text-center text-sm text-muted">주소 검색을 불러오지 못했어요. 우편번호와 주소를 직접 입력해 주세요.</p>
      ) : (
        <div className="relative h-[420px]">
          {/* 카카오 스크립트가 이 div 안을 직접 채우므로 React 자식은 두지 않는다 */}
          <div ref={containerRef} className="size-full" />
          {!ready && <p className="absolute inset-x-0 top-0 px-4 py-8 text-center text-sm text-muted">주소 검색을 불러오는 중이에요…</p>}
        </div>
      )}
    </div>
  );
}
