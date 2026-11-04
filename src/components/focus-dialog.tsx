"use client";
import { useId, type ReactNode } from "react";
import { useDialogMotion } from "./use-dialog-motion";
import { X } from "lucide-react";
export default function FocusDialog({
  title: heading,
  status,
  onClose,
  children,
  className = "",
  closeLabel = "Đóng chi tiết từ khóa",
}: {
  title: string;
  status?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  closeLabel?: string;
}) {
  const { ref, close } = useDialogMotion(onClose),
    title = useId();
  return (
    <dialog
      ref={ref}
      className={`query-detail-dialog ${className}`}
      aria-labelledby={title}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current!.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            close();
        }
      }}
    >
      <header className="query-dialog-heading">
        <div>
          <h2 id={title}>{heading}</h2>
          {status}
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label={closeLabel}
          onClick={close}
        >
          <X size={22} aria-hidden="true" />
        </button>
      </header>
      {children}
    </dialog>
  );
}
