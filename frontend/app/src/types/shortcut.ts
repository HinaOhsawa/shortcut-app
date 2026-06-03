// frontend/app/src/types/shortcut.ts
export type Application = {
  id: string;
  name: string;
};

export type Category = {
  id: string;
  name: string;
  sort_order?: number;
};

// ショートカットの型定義
export type Shortcut = {
  id: string;
  shortcut_key: string;
  command_name: string;
  note?: string;
  sort_order?: number | null;
  app?: string | null;
  app_name?: string | null;
  category?: string | null;
  category_name?: string | null;
};

// ショートカットフォームのプロパティ型定義
export type ShortcutFormProps = {
  onClose: () => void;
  onSaved: (shortcut: Shortcut, mode: "create" | "update") => void;
  shortcut?: Shortcut;
};
