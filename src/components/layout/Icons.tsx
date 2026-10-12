import type { SVGProps } from "react";
type IconProps = SVGProps<SVGSVGElement>;
const base = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
export function SearchIcon(props: IconProps) { return <svg {...base} {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>; }
export function UserIcon(props: IconProps) { return <svg {...base} {...props}><circle cx="12" cy="8" r="4" /><path d="M4.8 21a7.2 7.2 0 0 1 14.4 0" /></svg>; }
export function CartIcon(props: IconProps) { return <svg {...base} {...props}><path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H6" /><circle cx="9.5" cy="20" r="1" /><circle cx="17" cy="20" r="1" /></svg>; }
export function HomeIcon(props: IconProps) { return <svg {...base} {...props}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></svg>; }
export function GridIcon(props: IconProps) { return <svg {...base} {...props}><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></svg>; }
