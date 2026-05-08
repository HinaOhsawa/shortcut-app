// frontend/app/src/lib/login.ts
import { apiUrl } from "@/lib/apiBase";

export type LoginResponse = {
  user: {
    id: string;
    email: string;
    name: string;
  };
};

// 認証情報は HttpOnly Cookie でサーバから降ってくるため、
// クライアントは user 情報だけ受け取る。
export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  const res = await fetch(apiUrl("/api/accounts/login/"), {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.detail || "ログインに失敗しました");
  }
  return data;
}
