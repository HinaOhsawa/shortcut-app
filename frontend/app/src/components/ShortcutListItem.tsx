// frontend/app/src/components/ShortcutListItem.tsx
"use client";
import { Shortcut } from "@/types/shortcut";

type Props = {
  shortcut: Shortcut;
};

function renderKeys(shortcutKey: string) {
  return shortcutKey
    .split(/\s*\+\s*/)
    .filter(Boolean)
    .map((key, i, arr) => (
      <span key={`${key}-${i}`} className="inline-flex items-center">
        <kbd className="px-1.5 py-0.5 text-xs font-semibold text-indigo-600 bg-white border border-indigo-200 rounded shadow-sm">
          {key}
        </kbd>
        {i < arr.length - 1 && (
          <span className="mx-0.5 text-indigo-300 text-xs">+</span>
        )}
      </span>
    ));
}

export default function ShortcutListItem({ shortcut }: Props) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-white border border-indigo-100 rounded-md hover:border-indigo-300 hover:shadow-sm transition">
      <div className="flex flex-wrap items-center gap-1 min-w-[140px]">
        {renderKeys(shortcut.shortcut_key)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-indigo-600 truncate">
            {shortcut.command_name}
          </div>
          {shortcut.app_name && (
            <span className="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100 whitespace-nowrap">
              {shortcut.app_name}
            </span>
          )}
          {shortcut.category_name && (
            <span className="text-xs px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 whitespace-nowrap">
              {shortcut.category_name}
            </span>
          )}
        </div>
        {shortcut.note && (
          <p className="text-xs text-gray-500 truncate">{shortcut.note}</p>
        )}
      </div>
    </div>
  );
}
