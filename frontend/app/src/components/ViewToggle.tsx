// frontend/app/src/components/ViewToggle.tsx
"use client";
import { LayoutGrid, List } from "lucide-react";

export type ViewMode = "grid" | "list";

type Props = {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
};

export default function ViewToggle({ value, onChange }: Props) {
  const baseBtn =
    "flex items-center gap-1 px-3 py-1.5 text-sm transition focus:outline-none cursor-pointer";
  const active = "bg-primary text-primary-fg";
  const inactive = "bg-surface text-muted hover:bg-surface-2 hover:text-fg";

  return (
    <div className="inline-flex border border-line rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => onChange("grid")}
        className={`${baseBtn} ${value === "grid" ? active : inactive}`}
        aria-pressed={value === "grid"}
        aria-label="グリッド表示"
      >
        <LayoutGrid size={16} />
        グリッド
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        className={`${baseBtn} border-l border-line ${
          value === "list" ? active : inactive
        }`}
        aria-pressed={value === "list"}
        aria-label="リスト表示"
      >
        <List size={16} />
        リスト
      </button>
    </div>
  );
}
