import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  leadingIcon?: ReactNode;
}
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ id, label, error, hint, leadingIcon, className = "", ...props }, ref) {
  const inputId = id ?? `field-${props.name}`;
  const messageId = `${inputId}-message`;
  return (
    <div className="w-full">
      <label htmlFor={inputId} className="mb-2 block text-sm font-bold">{label}</label>
      <div className="relative">
        {leadingIcon && <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">{leadingIcon}</span>}
        <input ref={ref} id={inputId} aria-invalid={Boolean(error)} aria-describedby={error || hint ? messageId : undefined} className={`h-12 w-full rounded-md border bg-white px-4 text-[15px] outline-none transition placeholder:text-neutral-400 ${leadingIcon ? "pl-11" : ""} ${error ? "border-danger focus:border-danger" : "border-line focus:border-brand"} ${className}`} {...props} />
      </div>
      {(error || hint) && <p id={messageId} className={`mt-1.5 text-xs ${error ? "text-danger" : "text-muted"}`}>{error ?? hint}</p>}
    </div>
  );
});
