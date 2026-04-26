// frontend/app/src/components/ShortcutListItem.tsx
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
        <kbd className="px-1.5 py-0.5 text-xs font-semibold text-primary-soft-fg bg-surface border border-primary-soft-border rounded shadow-sm">
          {key}
        </kbd>
        {i < arr.length - 1 && (
          <span className="mx-0.5 text-subtle text-xs">+</span>
        )}
      </span>
    ));
}

const stopDrag = (e: React.MouseEvent) => e.stopPropagation();

export default function ShortcutListItem({
  shortcut,
  onEdit,
  onDelete,
}: Props) {
  const showActions = !!(onEdit || onDelete);
  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-surface border border-line rounded-md hover:border-primary hover:shadow-sm transition">
      <div className="flex flex-wrap items-center gap-1 min-w-[140px]">
        {renderKeys(shortcut.shortcut_key)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-fg truncate">
            {shortcut.command_name}
          </div>
          {shortcut.app_name && (
            <span className="text-xs px-1.5 py-0.5 bg-primary-soft text-primary-soft-fg rounded-full border border-primary-soft-border whitespace-nowrap">
              {shortcut.app_name}
            </span>
          )}
          {shortcut.category_name && (
            <span className="text-xs px-1.5 py-0.5 bg-accent-soft text-accent-soft-fg rounded-full border border-accent-soft-border whitespace-nowrap">
              {shortcut.category_name}
            </span>
          )}
        </div>
        {shortcut.note && (
          <p className="text-xs text-muted truncate">{shortcut.note}</p>
        )}
      </div>
      {showActions && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
          {onEdit && (
            <button
              type="button"
              draggable={false}
              onMouseDown={stopDrag}
              onClick={() => onEdit(shortcut)}
              aria-label="編集"
              className="p-1 rounded text-subtle hover:text-primary hover:bg-primary-soft"
            >
              <Pencil size={16} />
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
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
