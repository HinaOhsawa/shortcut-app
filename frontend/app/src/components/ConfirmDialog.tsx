// frontend/app/src/components/ConfirmDialog.tsx
"use client";
import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "OK",
  cancelLabel = "キャンセル",
  variant = "primary",
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmClass =
    variant === "danger"
      ? "bg-danger hover:bg-danger-hover text-danger-fg"
      : "bg-primary hover:bg-primary-hover text-primary-fg";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: "var(--overlay)" }}
    >
      <div className="relative bg-surface border border-line rounded-lg shadow-lg w-[420px] max-w-[90vw] p-5">
        <button
          type="button"
          aria-label="閉じる"
          onClick={onCancel}
          className="absolute top-3 right-3 p-1 rounded text-subtle hover:text-fg hover:bg-surface-2 transition"
        >
          <X size={20} />
        </button>
        <h2 className="text-lg font-semibold text-fg mb-2 pr-8">{title}</h2>
        {message && (
          <div className="text-sm text-muted mb-4">{message}</div>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="btn-secondary"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-60 cursor-pointer ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
