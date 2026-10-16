import type { InputHTMLAttributes, ReactNode } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon?: ReactNode;
  trailing?: ReactNode;
};

export default function Field({ label, icon, trailing, id, ...rest }: Props) {
  const fieldId = id ?? rest.name;
  return (
    <label htmlFor={fieldId} className="block">
      <span className="sr-only">{label}</span>
      <div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-white/80 dark:border-white/10 dark:bg-white/10 px-4 py-3.5 shadow-card focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-200">
        {icon && <span className="text-brand-400">{icon}</span>}
        <input
          id={fieldId}
          placeholder={label}
          className="w-full bg-transparent text-[15px] text-ink dark:text-white placeholder:text-ink-muted focus:outline-none"
          {...rest}
        />
        {trailing}
      </div>
    </label>
  );
}
