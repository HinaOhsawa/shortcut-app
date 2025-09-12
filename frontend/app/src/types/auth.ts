export type SignupErrors = {
  name?: string[];
  email?: string[];
  password?: string[];
  non_field_errors?: string[]; // もしSerializerでraiseした場合にここに入る
  detail?: string; // 認証エラー等の一般メッセージ
};
