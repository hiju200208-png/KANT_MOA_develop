import Link from "next/link";
interface SectionHeaderProps { title: string; description?: string; href?: string; }
export function SectionHeader({ title, description, href }: SectionHeaderProps) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-black tracking-[-0.035em] md:text-2xl">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {href && <Link href={href} className="brand-gradient-text-hover shrink-0 text-sm font-bold text-muted">전체보기 <span aria-hidden="true">›</span></Link>}
    </div>
  );
}
