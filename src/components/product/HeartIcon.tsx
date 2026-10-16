// 좋아요 하트. filled면 채운 하트
export function HeartIcon({ filled = false, className = "size-5" }: { filled?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
      <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.9c0 5.6-7.5 10.2-7.5 10.2Z" />
    </svg>
  );
}
