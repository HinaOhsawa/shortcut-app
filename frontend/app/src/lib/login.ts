// frontend/app/src/lib/login.ts
export type LoginResponse = {
  access: string;
  refresh: string;
  user: {
    id: number;
    email: string;
    name: string;
  };
};

export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  const res = await fetch("http://localhost:8000/api/accounts/login/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json(); // サーバーのレスポンスを読む

  if (!res.ok) {
    throw new Error(data.detail || "ログインに失敗しました");
  }
  return data;
}
