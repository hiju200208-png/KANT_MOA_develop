// 결제 완료 표시. 원이 톡 튀어나오고 체크가 그려진 뒤, 소다 거품이 위로 올라가며 사라진다.
// globals.css에 keyframes를 추가하지 않도록 SVG 자체 애니메이션(<animate>)을 사용한다.
// 동작 줄이기 설정을 켠 사용자에게는 애니메이션 없는 정지 버전을 보여준다.

const CHECK_PATH = "M47 70 l9 9 l18 -19";
const CHECK_LENGTH = 40;

// [x, 시작 y, 끝 y, 반지름, 시작 지연(초), 지속(초)]
const BUBBLES: [number, number, number, number, number, number][] = [
  [34, 92, 22, 5, 0.55, 1.4],
  [50, 100, 8, 3.5, 0.75, 1.6],
  [66, 98, 14, 6, 0.6, 1.5],
  [84, 94, 26, 4, 0.85, 1.3],
  [42, 86, 36, 2.5, 1.05, 1.1],
  [76, 88, 4, 3, 1.15, 1.7],
  [58, 90, 30, 2.5, 1.3, 1.2],
];

export function PaymentSuccessMark() {
  return (
    <div className="mx-auto size-28 text-brand" aria-hidden="true">
      <svg viewBox="0 0 120 120" className="size-full overflow-visible motion-reduce:hidden">
        {BUBBLES.map(([x, fromY, toY, r, begin, dur], i) => (
          <circle key={i} cx={x} cy={fromY} r={r} fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" opacity="0">
            <animate attributeName="cy" from={fromY} to={toY} begin={`${begin}s`} dur={`${dur}s`} fill="freeze" calcMode="spline" keySplines="0.2 0.6 0.4 1" />
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.7;1" begin={`${begin}s`} dur={`${dur}s`} fill="freeze" />
          </circle>
        ))}

        <g transform="translate(60 70)">
          <g>
            <animateTransform attributeName="transform" type="scale" values="0;1.12;1" keyTimes="0;0.7;1" dur="0.45s" fill="freeze" />
            <circle r="30" fill="currentColor" />
          </g>
        </g>

        <path d={CHECK_PATH} fill="none" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={CHECK_LENGTH} strokeDashoffset={CHECK_LENGTH}>
          <animate attributeName="stroke-dashoffset" from={CHECK_LENGTH} to="0" begin="0.3s" dur="0.4s" fill="freeze" />
        </path>
      </svg>

      <svg viewBox="0 0 120 120" className="hidden size-full motion-reduce:block">
        <circle cx="60" cy="70" r="30" fill="currentColor" />
        <path d={CHECK_PATH} fill="none" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
