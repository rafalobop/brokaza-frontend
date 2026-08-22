import type { ReactNode } from "react";

/** Port de `.modal-overlay`/`.modal-card` (matchouse/src/dashboard/style.css). */
interface ModalProps {
  children: ReactNode;
  wide?: boolean;
}

export function Modal({ children, wide = false }: ModalProps) {
  return (
    <div className="bg-forest/60 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div
        className={`rounded-radius-lg border-card-border bg-paper text-forest dark:text-foreground flex max-h-[85vh] w-full flex-col gap-5 overflow-y-auto border p-6 shadow-(--shadow) dark:bg-[#1F292B] ${wide ? "max-w-2xl" : "max-w-md"}`}
      >
        {children}
      </div>
    </div>
  );
}
