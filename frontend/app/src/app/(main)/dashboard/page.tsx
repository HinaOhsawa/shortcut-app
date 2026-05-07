// frontend/app/src/app/(main)/dashboard/page.tsx
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppWindow, Folder, Keyboard, Plus } from "lucide-react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { apiUrl } from "@/lib/apiBase";
import { useNavData } from "@/app/context/NavDataContext";

export default function DashboardPage() {
  const { apps, categories } = useNavData();
  const [shortcutCount, setShortcutCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchWithAuth(apiUrl("/api/shortcuts/"));
        setShortcutCount(Array.isArray(data) ? data.length : 0);
      } catch (err) {
        console.error("ショートカット取得失敗:", err);
      }
    })();
  }, []);

  const cards = [
    {
      label: "ショートカット",
      count: shortcutCount,
      icon: Keyboard,
      href: "/shortcuts",
    },
    {
      label: "アプリ",
      count: apps.length,
      icon: AppWindow,
      href: "/applications",
    },
    {
      label: "カテゴリ",
      count: categories.length,
      icon: Folder,
      href: "/categories",
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-fg">ダッシュボード</h1>
        <Link href="/shortcuts?new=1" className="btn">
          <Plus size={16} />
          ショートカット作成
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="flex flex-col gap-2 p-5 bg-surface border border-line rounded-lg hover:border-primary hover:shadow-sm transition"
          >
            <div className="flex items-center gap-2 text-primary">
              <c.icon size={18} />
              <span className="text-sm font-medium">{c.label}</span>
            </div>
            <div className="text-3xl font-bold text-fg">
              {c.count === null ? "—" : c.count}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
