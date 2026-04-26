// frontend/app/src/app/(main)/shortcuts/page.tsx
"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GripVertical, X as XIcon } from "lucide-react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import ShortcutForm from "@/components/ShortcutForm";
import ShortcutCard from "@/components/ShortcutCard";
import ShortcutListItem from "@/components/ShortcutListItem";
import ViewToggle, { ViewMode } from "@/components/ViewToggle";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useNavData } from "@/app/context/NavDataContext";
import { Shortcut } from "@/types/shortcut";

function ShortcutsView() {
  const searchParams = useSearchParams();
  const appFilter = searchParams.get("app") ?? "";
  const categoryFilter = searchParams.get("category") ?? "";
  const searchQuery = searchParams.get("q") ?? "";
  const newFlag = searchParams.get("new") === "1";
  const { apps, categories } = useNavData();

  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState<Shortcut | undefined>(
    undefined
  );
  const [pendingDelete, setPendingDelete] = useState<Shortcut | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const url = new URL("http://localhost:8000/api/shortcuts/");
        if (appFilter) url.searchParams.set("app", appFilter);
        if (categoryFilter) url.searchParams.set("category", categoryFilter);
        if (searchQuery) url.searchParams.set("search", searchQuery);
        const data = await fetchWithAuth(url.toString());
        setShortcuts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("認証エラー:", err);
      }
    })();
  }, [appFilter, categoryFilter, searchQuery]);

  useEffect(() => {
    if (newFlag) {
      setEditingShortcut(undefined);
      setShowForm(true);
    }
  }, [newFlag]);

  const openCreate = () => {
    setEditingShortcut(undefined);
    setShowForm(true);
  };

  const openEdit = (shortcut: Shortcut) => {
    setEditingShortcut(shortcut);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingShortcut(undefined);
  };

  const handleSaved = (saved: Shortcut, mode: "create" | "update") => {
    if (mode === "create") {
      setShortcuts((prev) => [saved, ...prev]);
    } else {
      setShortcuts((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
    }
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return;
    setDeleteBusy(true);
    try {
      await fetchWithAuth(
        `http://localhost:8000/api/shortcuts/${pendingDelete.id}/`,
        { method: "DELETE" }
      );
      setShortcuts((prev) => prev.filter((s) => s.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch (err) {
      console.error("削除に失敗:", err);
      alert("削除に失敗しました");
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleDragStart =
    (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
      setDraggedIndex(index);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    };

  const handleDragOver =
    (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (draggedIndex !== null && draggedIndex !== index) {
        setDragOverIndex(index);
      }
    };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const persistOrder = async (items: Shortcut[], previous: Shortcut[]) => {
    try {
      await fetchWithAuth("http://localhost:8000/api/shortcuts/reorder/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: items.map((s) => s.id) }),
      });
    } catch (err) {
      console.error("並び順の保存に失敗:", err);
      setShortcuts(previous);
      alert("並び順の保存に失敗しました");
    }
  };

  const handleDrop =
    (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === index) {
        setDraggedIndex(null);
        setDragOverIndex(null);
        return;
      }
      const previous = shortcuts;
      const next = [...shortcuts];
      const [moved] = next.splice(draggedIndex, 1);
      next.splice(index, 0, moved);
      setShortcuts(next);
      setDraggedIndex(null);
      setDragOverIndex(null);
      persistOrder(next, previous);
    };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const dragWrapperClass = (index: number, extra = "") => {
    const isDragging = draggedIndex === index;
    const isOver = dragOverIndex === index && draggedIndex !== index;
    return [
      "group relative transition",
      isDragging ? "opacity-40" : "",
      isOver ? "ring-2 ring-primary rounded-lg" : "",
      extra,
    ]
      .filter(Boolean)
      .join(" ");
  };

  const appName = apps.find((a) => a.id === appFilter)?.name;
  const categoryName = categories.find((c) => c.id === categoryFilter)?.name;
  const hasFilter = !!(appFilter || categoryFilter || searchQuery);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-fg">
          ショートカット一覧
        </h1>
        <div className="flex items-center gap-3">
          <ViewToggle value={viewMode} onChange={setViewMode} />
          <button className="btn" onClick={openCreate}>
            ＋ ショートカット追加
          </button>
        </div>
      </div>

      {hasFilter && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          <span className="text-muted">フィルター:</span>
          {appName && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-soft text-primary-soft-fg rounded-full border border-primary-soft-border">
              アプリ: {appName}
            </span>
          )}
          {categoryName && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-soft text-accent-soft-fg rounded-full border border-accent-soft-border">
              カテゴリ: {categoryName}
            </span>
          )}
          {searchQuery && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-info-soft text-info-soft-fg rounded-full border border-info-soft-border">
              検索: {searchQuery}
            </span>
          )}
          <Link
            href="/shortcuts"
            className="inline-flex items-center gap-1 text-muted hover:text-fg hover:underline"
          >
            <XIcon size={14} />
            クリア
          </Link>
        </div>
      )}

      {showForm && (
        <ShortcutForm
          key={editingShortcut?.id ?? "new"}
          shortcut={editingShortcut}
          onClose={closeForm}
          onSaved={handleSaved}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="ショートカットを削除しますか？"
        message={
          pendingDelete ? (
            <div className="flex flex-col gap-3">
              <p>以下のショートカットを削除します。この操作は取り消せません。</p>
              <ShortcutListItem shortcut={pendingDelete} />
            </div>
          ) : undefined
        }
        confirmLabel="削除"
        variant="danger"
        busy={deleteBusy}
        onConfirm={handleDeleteConfirm}
        onCancel={() => !deleteBusy && setPendingDelete(null)}
      />

      {shortcuts.length === 0 ? (
        <div className="text-center py-16 text-muted">
          {hasFilter
            ? "条件に一致するショートカットがありません。"
            : "ショートカットがまだ登録されていません。"}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {shortcuts.map((s, i) => (
            <div
              key={s.id}
              draggable
              onDragStart={handleDragStart(i)}
              onDragOver={handleDragOver(i)}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop(i)}
              onDragEnd={handleDragEnd}
              className={dragWrapperClass(
                i,
                "cursor-grab active:cursor-grabbing"
              )}
            >
              <div className="absolute top-2 left-2 text-subtle opacity-0 group-hover:opacity-100 transition pointer-events-none">
                <GripVertical size={16} />
              </div>
              <ShortcutCard
                shortcut={s}
                onEdit={openEdit}
                onDelete={setPendingDelete}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {shortcuts.map((s, i) => (
            <div
              key={s.id}
              draggable
              onDragStart={handleDragStart(i)}
              onDragOver={handleDragOver(i)}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop(i)}
              onDragEnd={handleDragEnd}
              className={dragWrapperClass(
                i,
                "flex items-center gap-2 cursor-grab active:cursor-grabbing"
              )}
            >
              <div className="text-subtle opacity-0 group-hover:opacity-100 transition">
                <GripVertical size={16} />
              </div>
              <div className="flex-1">
                <ShortcutListItem
                  shortcut={s}
                  onEdit={openEdit}
                  onDelete={setPendingDelete}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ShortcutsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-subtle">読み込み中...</div>}>
      <ShortcutsView />
    </Suspense>
  );
}
