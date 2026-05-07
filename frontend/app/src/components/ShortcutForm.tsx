// frontend/app/src/components/ShortcutForm.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { apiUrl } from "@/lib/apiBase";
import {
  Application,
  Category,
  ShortcutFormProps,
} from "@/types/shortcut";

const IGNORED_KEYS = new Set([
  "Meta",
  "Control",
  "Alt",
  "Shift",
  "OS",
  "Dead",
]);

function normalizeKey(e: React.KeyboardEvent<HTMLDivElement>): string | null {
  const k = e.key;
  if (IGNORED_KEYS.has(k)) return null;
  if (k === " ") return "Space";
  if (k === "Escape") return "Esc";
  if (k === "ArrowUp") return "↑";
  if (k === "ArrowDown") return "↓";
  if (k === "ArrowLeft") return "←";
  if (k === "ArrowRight") return "→";
  if (k.length === 1) return k.toUpperCase();
  return k;
}

function isMac() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
}

function buildCombo(
  e: React.KeyboardEvent<HTMLDivElement>,
  mac: boolean
): string | null {
  const mainKey = normalizeKey(e);
  if (!mainKey) return null;
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push(mac ? "Option" : "Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push(mac ? "Cmd" : "Win");
  parts.push(mainKey);
  return parts.join(" + ");
}

type Option = { id: string; name: string };

type SelectOrCreateProps = {
  label: string;
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  onCreate: (name: string) => Promise<Option | null>;
  placeholder?: string;
};

function SelectOrCreate({
  label,
  options,
  value,
  onChange,
  onCreate,
  placeholder,
}: SelectOrCreateProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    const created = await onCreate(name);
    setBusy(false);
    if (created) {
      onChange(created.id);
      setNewName("");
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-muted">{label}</span>
      {creating ? (
        <div className="flex gap-2">
          <input
            placeholder={`新しい${label}名`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy || !newName.trim()}
            className="btn whitespace-nowrap"
          >
            追加
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setNewName("");
            }}
            className="btn-secondary whitespace-nowrap"
          >
            取消
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">{placeholder ?? `${label}を選択`}</option>
            {options.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="px-3 py-2 border border-primary-soft-border text-primary rounded-md hover:bg-primary-soft transition cursor-pointer whitespace-nowrap"
          >
            ＋新規
          </button>
        </div>
      )}
    </div>
  );
}

export default function ShortcutForm({
  onClose,
  onSaved,
  shortcut,
}: ShortcutFormProps) {
  const isEdit = !!shortcut;
  const [commandName, setCommandName] = useState(shortcut?.command_name ?? "");
  const [shortcutKey, setShortcutKey] = useState(shortcut?.shortcut_key ?? "");
  const [note, setNote] = useState(shortcut?.note ?? "");
  const [capturing, setCapturing] = useState(false);
  const [mac, setMac] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);

  const [apps, setApps] = useState<Application[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [appId, setAppId] = useState(shortcut?.app ?? "");
  const [categoryId, setCategoryId] = useState(shortcut?.category ?? "");

  useEffect(() => {
    setMac(isMac());
    (async () => {
      try {
        const [appsData, catsData] = await Promise.all([
          fetchWithAuth(apiUrl("/api/shortcuts/applications/")),
          fetchWithAuth(apiUrl("/api/shortcuts/categories/")),
        ]);
        setApps(Array.isArray(appsData) ? appsData : []);
        setCategories(Array.isArray(catsData) ? catsData : []);
      } catch (err) {
        console.error("アプリ・カテゴリ取得失敗:", err);
      }
    })();
  }, []);

  const createApp = async (name: string): Promise<Application | null> => {
    try {
      const created: Application = await fetchWithAuth(
        apiUrl("/api/shortcuts/applications/"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }
      );
      setApps((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      return created;
    } catch (err) {
      console.error(err);
      alert("アプリの追加に失敗しました");
      return null;
    }
  };

  const createCategory = async (name: string): Promise<Category | null> => {
    try {
      const created: Category = await fetchWithAuth(
        apiUrl("/api/shortcuts/categories/"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }
      );
      setCategories((prev) => [...prev, created]);
      return created;
    } catch (err) {
      console.error(err);
      alert("カテゴリの追加に失敗しました");
      return null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!capturing) return;
    e.preventDefault();
    e.stopPropagation();
    const combo = buildCombo(e, mac);
    if (combo) {
      setShortcutKey(combo);
      setCapturing(false);
      captureRef.current?.blur();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shortcutKey.trim()) {
      alert("ショートカットキーを入力してください");
      return;
    }
    try {
      const url = isEdit
        ? apiUrl(`/api/shortcuts/${shortcut!.id}/`)
        : apiUrl("/api/shortcuts/");
      const saved = await fetchWithAuth(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command_name: commandName,
          shortcut_key: shortcutKey,
          note,
          app: appId || null,
          category: categoryId || null,
        }),
      });
      onSaved(saved, isEdit ? "update" : "create");
      onClose();
    } catch (err) {
      console.error(err);
      alert(isEdit ? "更新に失敗しました" : "登録に失敗しました");
    }
  };

  const keyParts = shortcutKey
    ? shortcutKey.split(/\s*\+\s*/).filter(Boolean)
    : [];

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: "var(--overlay)" }}
    >
      <div className="relative bg-surface border border-line p-5 rounded-lg w-[480px] max-h-[90vh] overflow-y-auto shadow-lg">
        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="absolute top-3 right-3 p-1 rounded text-subtle hover:text-fg hover:bg-surface-2 transition"
        >
          <X size={20} />
        </button>
        <h2 className="text-lg font-semibold mb-4 text-fg">
          {isEdit ? "ショートカット編集" : "ショートカット登録"}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-muted">コマンド名</span>
            <input
              placeholder="例: コマンドパレットを開く"
              value={commandName}
              onChange={(e) => setCommandName(e.target.value)}
            />
          </label>

          <SelectOrCreate
            label="アプリ"
            options={apps}
            value={appId}
            onChange={setAppId}
            onCreate={createApp}
            placeholder="アプリを選択（任意）"
          />

          <SelectOrCreate
            label="カテゴリ"
            options={categories}
            value={categoryId}
            onChange={setCategoryId}
            onCreate={createCategory}
            placeholder="カテゴリを選択（任意）"
          />

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-muted">
              ショートカットキー
            </span>
            <div
              ref={captureRef}
              role="button"
              tabIndex={0}
              onClick={() => {
                setCapturing(true);
                captureRef.current?.focus();
              }}
              onFocus={() => setCapturing(true)}
              onBlur={() => setCapturing(false)}
              onKeyDown={handleKeyDown}
              className={`border p-2 rounded-md min-h-[44px] flex flex-wrap items-center gap-1 cursor-text outline-none transition ${
                capturing
                  ? "border-primary ring-2 ring-primary/30 bg-primary-soft"
                  : "border-line bg-surface"
              }`}
            >
              {keyParts.length > 0 ? (
                keyParts.map((key, i, arr) => (
                  <span key={`${key}-${i}`} className="inline-flex items-center">
                    <kbd className="px-2 py-0.5 text-sm font-semibold text-primary-soft-fg bg-surface border border-primary-soft-border rounded shadow-sm">
                      {key}
                    </kbd>
                    {i < arr.length - 1 && (
                      <span className="mx-1 text-subtle">+</span>
                    )}
                  </span>
                ))
              ) : (
                <span className="text-sm text-subtle">
                  {capturing
                    ? "キーを押してください…"
                    : "クリックしてキーを入力"}
                </span>
              )}
            </div>
            {shortcutKey && (
              <button
                type="button"
                onClick={() => {
                  setShortcutKey("");
                  setCapturing(true);
                  captureRef.current?.focus();
                }}
                className="self-start text-xs text-primary hover:underline"
              >
                クリアして再入力
              </button>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-muted">補足メモ</span>
            <textarea
              placeholder="補足メモ（任意）"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>

          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              キャンセル
            </button>
            <button type="submit" className="btn">
              {isEdit ? "更新" : "登録"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
