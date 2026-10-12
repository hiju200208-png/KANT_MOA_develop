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
        src="/brand/kant-moa-logo-black.png"
        alt="KANT MOA"
        width={203}
        height={52}
        priority
        className="h-auto w-[156px] transition-[filter,transform] duration-300 group-hover:brightness-75 group-hover:scale-[1.02] sm:w-[174px]"
      />
    </Link>
  );
}
