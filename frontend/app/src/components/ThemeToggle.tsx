// frontend/app/src/components/ThemeToggle.tsx
"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "@/app/context/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "ライトモードに切替" : "ダークモードに切替"}
      title={theme === "dark" ? "ライトモード" : "ダークモード"}
      className="p-2 rounded-md text-muted hover:text-fg hover:bg-surface-2 transition cursor-pointer"
    >
      {mounted && theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
