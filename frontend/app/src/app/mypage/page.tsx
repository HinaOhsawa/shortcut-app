// frontend/app/src/app/mypage/page.tsx
"use client";
import { use, useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import ShortcutForm from "@/components/ShortcutForm";
import { Shortcut } from "@/types/shortcut";

export default function ShortcutPage() {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchWithAuth(
          "http://localhost:8000/api/shortcuts/"
        );
        setShortcuts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("認証エラー:", err);
      }
    })();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">ショートカット一覧</h1>
      <button
        className="bg-blue-500 text-white px-4 py-2 mb-4 rounded"
        onClick={() => setShowForm(true)}
      >
        ＋ ショートカット追加
      </button>

      {showForm && (
        <ShortcutForm
          onClose={() => setShowForm(false)}
          onAdded={(newShortcut: Shortcut) =>
            setShortcuts([newShortcut, ...shortcuts])
          }
        />
      )}

      <ul>
        {shortcuts.map((s) => (
          <li key={s.id} className="border-b py-2">
            <strong>{s.shortcut_key}</strong> → {s.command_name}
          </li>
        ))}
      </ul>
    </div>
  );
}
