import { useEffect, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Port de `.modal-overlay`/`.modal-card` (matchouse/src/dashboard/style.css). */
interface ModalProps {
  children: ReactNode;
  wide?: boolean;
  /**
   * Cierra el modal al hacer click en el backdrop o presionar Escape. Opcional porque algunos
   * usos (ej. mientras hay una operación en curso) prefieren forzar el cierre solo vía botón.
   */
  onClose?: () => void;
}

export function Modal({ children, wide = false, onClose }: ModalProps) {
  useEffect(() => {
    if (!onClose) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose?.();
  }

  // Portal a `document.body`: si no, `fixed inset-0` queda posicionado relativo al panel
  // translúcido de `DashboardShell` (su `backdrop-blur-xl` crea un containing block para
  // descendientes `fixed`, por spec de `backdrop-filter`), y el modal termina apareciendo
  // desplazado en vez de centrado en el viewport.
  return createPortal(
    <div
      className="bg-forest/60 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className={`rounded-radius-lg border-card-border bg-paper/75 text-foreground dark:bg-[#1F292B]/75 flex max-h-[85vh] w-full flex-col gap-5 overflow-y-auto border p-6 shadow-(--shadow) backdrop-blur-xl ${wide ? "max-w-2xl" : "max-w-md"}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
