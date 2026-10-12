import type { ButtonHTMLAttributes } from "react";
type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
}
const variants: Record<ButtonVariant, string> = {
  primary: "bg-foreground text-white hover:bg-gradient-to-r hover:from-teal-400 hover:via-violet-400 hover:to-pink-400 hover:shadow-lg hover:shadow-violet-200/50 disabled:bg-neutral-300 disabled:bg-none",
  secondary: "bg-brand text-white hover:bg-gradient-to-r hover:from-teal-400 hover:via-violet-400 hover:to-pink-400 hover:shadow-lg hover:shadow-violet-200/50 disabled:bg-teal-200 disabled:bg-none",
  outline: "brand-gradient-soft-hover border border-line bg-white text-foreground hover:border-violet-300",
  ghost: "brand-gradient-soft-hover bg-transparent text-foreground",
  danger: "bg-danger text-white hover:bg-red-600 disabled:bg-red-200",
};
const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-base",
};
export function Button({ className = "", variant = "primary", size = "md", fullWidth = false, loading = false, disabled, children, ...props }: ButtonProps) {
  return (
    <button className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-bold transition-all disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${fullWidth ? "w-full" : ""} ${className}`} disabled={disabled || loading} aria-busy={loading} {...props}>
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />}
      {children}
    </button>
  );
}
