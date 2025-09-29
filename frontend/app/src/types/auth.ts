// frontend/app/src/types/auth.ts

// ユーザーデータの型定義
export type User = {
  id: number;
  name: string;
  email: string;
};

export type SignupErrors = {
  name?: string[];
  email?: string[];
  password?: string[];
  non_field_errors?: string[]; // もしSerializerでraiseした場合にここに入る
  detail?: string; // 認証エラー等の一般メッセージ
};
