import Link from "next/link";
import { Button } from "@/components/ui";

// [x, 시작 y, 끝 y, 반지름, 지연(초), 지속(초)] — 쇼핑백 위로 소다 거품이 천천히 떠오른다.
const BUBBLES: [number, number, number, number, number, number][] = [
  [44, 62, 14, 4, 0, 3.2],
  [62, 58, 8, 2.5, 1.1, 2.8],
  [78, 64, 18, 5, 0.6, 3.6],
  [96, 60, 10, 3, 1.8, 3],
  [70, 60, 22, 2, 2.4, 2.6],
];

// 장바구니가 비었을 때 보여주는 화면. 거품 애니메이션은 동작 줄이기 설정이면 멈춘다.
export function CartEmpty() {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-lg bg-white px-6 py-10 text-center shadow-card">
      <svg viewBox="0 0 140 130" className="w-36 text-brand" aria-hidden="true">
        <g className="motion-reduce:hidden">
          {BUBBLES.map(([x, fromY, toY, r, begin, dur], i) => (
            <circle key={i} cx={x} cy={fromY} r={r} fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" opacity="0">
              <animate attributeName="cy" values={`${fromY};${toY}`} begin={`${begin}s`} dur={`${dur}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.2;0.7;1" begin={`${begin}s`} dur={`${dur}s`} repeatCount="indefinite" />
            </circle>
          ))}
        </g>
        <path d="M54 66 v-6 a16 16 0 0 1 32 0 v6" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <rect x="34" y="64" width="72" height="56" rx="14" fill="currentColor" />
        <rect x="34" y="64" width="72" height="56" rx="14" fill="white" fillOpacity="0.18" />
        <path d="M58 94 q12 9 24 0" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" />
        <circle cx="58" cy="84" r="3" fill="white" />
        <circle cx="82" cy="84" r="3" fill="white" />
      </svg>
      <h2 className="mt-5 text-lg font-black">장바구니가 비어 있어요</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted">좋아하는 아티스트의 굿즈를 담아보세요.</p>
      <Link href="/" className="mt-6">
        <Button>굿즈 보러가기</Button>
      </Link>
    </div>
  );
}
