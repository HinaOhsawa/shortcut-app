// frontend/app/src/components/ShortcutForm.tsx
"use client";
import { useState } from "react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { ShortcutFormProps } from "@/types/shortcut";

export default function ShortcutForm({ onClose, onAdded }: ShortcutFormProps) {
  const [commandName, setCommandName] = useState("");
  const [shortcutKey, setShortcutKey] = useState("");
  const [note, setNote] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newShortcut = await fetchWithAuth(
        "http://localhost:8000/api/shortcuts/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command_name: commandName,
            shortcut_key: shortcutKey,
            note,
          }),
        }
      );
      onAdded(newShortcut);
      onClose();
    } catch (err) {
      console.error(err);
      alert("登録に失敗しました");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="border p-4 rounded w-96">
        <h2 className="text-lg font-semibold mb-2">ショートカット登録</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <input
            className="border p-2"
            placeholder="コマンド名"
            value={commandName}
            onChange={(e) => setCommandName(e.target.value)}
          />
          <input
            className="border p-2"
            placeholder="ショートカットキー"
            value={shortcutKey}
            onChange={(e) => setShortcutKey(e.target.value)}
          />
          <textarea
            className="border p-2"
            placeholder="補足メモ"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              登録
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
