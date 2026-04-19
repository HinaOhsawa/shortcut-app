// frontend/app/src/components/ShortcutCard.tsx
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
        <kbd className="px-2 py-1 text-sm font-semibold text-indigo-600 bg-white border border-indigo-200 rounded shadow-sm">
          {key}
        </kbd>
        {i < arr.length - 1 && (
          <span className="mx-1 text-indigo-300">+</span>
        )}
      </span>
    ));
}

export default function ShortcutCard({ shortcut }: Props) {
  return (
    <div className="flex flex-col gap-3 p-4 bg-white border border-indigo-100 rounded-lg shadow-sm hover:shadow-md hover:border-indigo-300 transition">
      <div className="flex flex-wrap items-center gap-1">
        {renderKeys(shortcut.shortcut_key)}
      </div>
      <div className="text-base font-semibold text-indigo-600">
        {shortcut.command_name}
      </div>
      <div className="flex flex-wrap gap-1">
        {shortcut.app_name && (
          <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100">
            {shortcut.app_name}
          </span>
        )}
        {shortcut.category_name && (
          <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
            {shortcut.category_name}
          </span>
        )}
      </div>
      {shortcut.note && (
        <p className="text-sm text-gray-500 line-clamp-3">{shortcut.note}</p>
      )}
    </div>
  );
}
