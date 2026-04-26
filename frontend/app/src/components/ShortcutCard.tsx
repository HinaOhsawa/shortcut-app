// frontend/app/src/components/ShortcutCard.tsx
"use client";
import { Pencil, Trash2 } from "lucide-react";
import { Shortcut } from "@/types/shortcut";

type Props = {
  shortcut: Shortcut;
  onEdit?: (shortcut: Shortcut) => void;
  onDelete?: (shortcut: Shortcut) => void;
};

function renderKeys(shortcutKey: string) {
  return shortcutKey
    .split(/\s*\+\s*/)
    .filter(Boolean)
    .map((key, i, arr) => (
      <span key={`${key}-${i}`} className="inline-flex items-center">
        <kbd className="px-2 py-1 text-sm font-semibold text-primary-soft-fg bg-surface border border-primary-soft-border rounded shadow-sm">
          {key}
        </kbd>
        {i < arr.length - 1 && (
          <span className="mx-1 text-subtle">+</span>
        )}
      </span>
    ));
}

const stopDrag = (e: React.MouseEvent) => e.stopPropagation();

export default function ShortcutCard({ shortcut, onEdit, onDelete }: Props) {
  const showActions = !!(onEdit || onDelete);
  return (
    <div className="relative flex flex-col gap-3 p-4 bg-surface border border-line rounded-lg shadow-sm hover:shadow-md hover:border-primary transition">
      {showActions && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
          {onEdit && (
            <button
              type="button"
              draggable={false}
              onMouseDown={stopDrag}
              onClick={() => onEdit(shortcut)}
              aria-label="編集"
              className="p-1 rounded text-subtle hover:text-primary hover:bg-primary-soft"
            >
              <Pencil size={14} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              draggable={false}
              onMouseDown={stopDrag}
              onClick={() => onDelete(shortcut)}
              aria-label="削除"
              className="p-1 rounded text-subtle hover:text-danger hover:bg-danger-soft"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1">
        {renderKeys(shortcut.shortcut_key)}
      </div>
      <div className="text-base font-semibold text-fg">
        {shortcut.command_name}
      </div>
      <div className="flex flex-wrap gap-1">
        {shortcut.app_name && (
          <span className="text-xs px-2 py-0.5 bg-primary-soft text-primary-soft-fg rounded-full border border-primary-soft-border">
            {shortcut.app_name}
          </span>
        )}
        {shortcut.category_name && (
          <span className="text-xs px-2 py-0.5 bg-accent-soft text-accent-soft-fg rounded-full border border-accent-soft-border">
            {shortcut.category_name}
          </span>
        )}
      </div>
      {shortcut.note && (
        <p className="text-sm text-muted line-clamp-3">{shortcut.note}</p>
      )}
    </div>
  );
}
