// frontend/app/src/lib/signup.ts
import { SignupErrors } from "@/types/auth";
import { apiUrl } from "@/lib/apiBase";
import { withCsrfHeader } from "@/lib/csrf";

// 認証情報は HttpOnly Cookie でサーバから降ってくるため、
// クライアントは user 情報を含むレスポンス Body のみ扱う。
export async function signup(name: string, email: string, password: string) {
  const res = await fetch(apiUrl("/api/accounts/register/"), {
    method: "POST",
    credentials: "same-origin",
    headers: withCsrfHeader({ "Content-Type": "application/json" }),
    body: JSON.stringify({ name, email, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("Signup error:", data);
    throw data as SignupErrors;
  }

  return data;
}
