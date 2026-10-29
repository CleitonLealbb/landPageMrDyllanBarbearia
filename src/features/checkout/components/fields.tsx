import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  ReactNode,
} from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function Field({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-[11px] font-medium text-muted-foreground">
      {label}
      <Input {...props} className={cn("h-9 min-w-0 rounded-lg bg-background/60 text-base text-foreground focus-visible:ring-2 sm:text-sm", className)} />
    </label>
  );
}
export function Choice({
  label,
  children,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-[11px] font-medium text-muted-foreground">
      {label}
      <select
        {...props}
        className={cn("h-9 w-full min-w-0 max-w-full truncate rounded-lg border border-input bg-background/60 px-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:text-sm", className)}
      >
        {children}
      </select>
    </label>
  );
}
export const panel = "rounded-xl border border-border/60 bg-card p-4 sm:p-5";
