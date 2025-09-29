// frontend/app/src/types/shortcut.ts
// ショートカットの型定義
export type Shortcut = {
  id: number;
  shortcut_key: string;
  command_name: string;
  note?: string;
};

// ショートカットフォームのプロパティ型定義
export type ShortcutFormProps = {
  onClose: () => void; // 閉じるだけなら引数なし
  onAdded: (newShortcut: Shortcut) => void; // 登録後に新しいショートカットを受け取る
};
