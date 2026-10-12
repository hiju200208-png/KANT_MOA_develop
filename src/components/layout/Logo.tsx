import Image from "next/image";
import Link from "next/link";

export function Logo() {
  return (
    <Link
      href="/"
      aria-label="KANT MOA 홈"
      className="group inline-flex shrink-0 items-center"
    >
      <Image
        src="/brand/kant-moa-bubble-logo-v3.png"
        alt="KANT MOA"
        width={2172}
        height={724}
        priority
        className="h-auto w-[156px] drop-shadow-[0_3px_7px_rgba(126,109,210,0.16)] transition-transform duration-500 group-hover:scale-[1.03] sm:w-[174px]"
      />
    </Link>
  );
}
