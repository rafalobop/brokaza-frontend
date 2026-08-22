import type { HTMLAttributes } from "react";

/** Port de `.card` (matchouse/src/dashboard/style.css). */
export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={`rounded-radius-lg border-card-border bg-card hover:border-accent-glow flex flex-col gap-4 border p-5 transition-colors duration-200 ${className}`}
    />
  );
}
