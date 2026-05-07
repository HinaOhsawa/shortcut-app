// frontend/app/src/lib/signup.ts
import { SignupErrors } from "@/types/auth";
import { apiUrl } from "@/lib/apiBase";

export async function signup(name: string, email: string, password: string) {
  const res = await fetch(apiUrl("/api/accounts/register/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });

  const data = await res.json();

  // エラーハンドリング
  if (!res.ok) {
    console.error("Signup error:", data);
    throw data as SignupErrors;
  }

  // JWTトークンを保存
  localStorage.setItem("accessToken", data.access);
  localStorage.setItem("refreshToken", data.refresh);

  return data;
}
