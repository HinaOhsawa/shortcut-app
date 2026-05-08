// frontend/app/src/lib/login.ts
import { apiUrl } from "@/lib/apiBase";
import { withCsrfHeader } from "@/lib/csrf";

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
    // 別ユーザーでログイン中など、access_token cookie が残っているとサーバが
    // CSRF を強制するため、csrftoken があれば添えておく。
    headers: withCsrfHeader({ "Content-Type": "application/json" }),
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.detail || "ログインに失敗しました");
  }
  return data;
}
