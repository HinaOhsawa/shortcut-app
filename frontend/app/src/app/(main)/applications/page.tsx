// frontend/app/src/app/(main)/applications/page.tsx
"use client";
import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X as XIcon } from "lucide-react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { apiUrl } from "@/lib/apiBase";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useNavData } from "@/app/context/NavDataContext";
import { Application } from "@/types/shortcut";

export default function ApplicationsPage() {
  const { apps, refreshApps } = useNavData();
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(
    null
  );
  const [pendingDelete, setPendingDelete] = useState<Application | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await fetchWithAuth(apiUrl("/api/shortcuts/applications/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setNewName("");
      await refreshApps();
    } catch (err) {
      console.error(err);
      alert("追加に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return;
    try {
      await fetchWithAuth(apiUrl(`/api/shortcuts/applications/${editing.id}/`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setEditing(null);
      await refreshApps();
    } catch (err) {
      console.error(err);
      alert("更新に失敗しました");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return;
    setDeleteBusy(true);
    try {
      await fetchWithAuth(
        apiUrl(`/api/shortcuts/applications/${pendingDelete.id}/`),
        { method: "DELETE" }
      );
      setPendingDelete(null);
      await refreshApps();
    } catch (err) {
      console.error(err);
      alert("削除に失敗しました");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-fg mb-6">アプリ</h1>

      <div className="mb-6 flex gap-2">
        <input
          placeholder="新しいアプリ名"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
          }}
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={busy || !newName.trim()}
          className="btn whitespace-nowrap"
        >
          <Plus size={16} />
          追加
        </button>
      </div>

      {apps.length === 0 ? (
        <div className="text-center py-16 text-muted">
          アプリが登録されていません
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {apps.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 px-4 py-3 bg-surface border border-line rounded-md hover:border-primary transition"
            >
              {editing?.id === a.id ? (
                <>
                  <input
                    className="!py-1.5"
                    value={editing.name}
                    onChange={(e) =>
                      setEditing({ ...editing, name: e.target.value })
                    }
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUpdate();
                      if (e.key === "Escape") setEditing(null);
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleUpdate}
                    aria-label="保存"
                    className="p-1.5 text-success-soft-fg hover:bg-success-soft rounded"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    aria-label="取消"
                    className="p-1.5 text-subtle hover:text-fg hover:bg-surface-2 rounded"
                  >
                    <XIcon size={16} />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-fg">{a.name}</span>
                  <button
                    type="button"
                    onClick={() => setEditing({ id: a.id, name: a.name })}
                    aria-label="編集"
                    className="p-1.5 text-subtle hover:text-primary hover:bg-primary-soft rounded"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(a)}
                    aria-label="削除"
                    className="p-1.5 text-subtle hover:text-danger hover:bg-danger-soft rounded"
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="アプリを削除しますか？"
        message={
          pendingDelete ? (
            <p>
              「{pendingDelete.name}」を削除します。このアプリに紐づくショートカットも削除されます。この操作は取り消せません。
            </p>
          ) : undefined
        }
        confirmLabel="削除"
        variant="danger"
        busy={deleteBusy}
        onConfirm={handleDeleteConfirm}
        onCancel={() => !deleteBusy && setPendingDelete(null)}
      />
    </div>
  );
}
