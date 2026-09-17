import { cn } from "@/lib/utils";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="SubmitReady"
      className={cn("size-8", className)}
    >
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path
        d="M9 10h14M9 15h9"
        stroke="var(--primary-foreground)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M9.5 21.5l3.2 3.2L20.5 15"
        fill="none"
        stroke="var(--primary-foreground)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <BrandLogo className="size-7 text-primary" />
      <span className="text-base font-bold tracking-tight">
        Submit<span className="text-primary">Ready</span>
      </span>
    </span>
  );
}
