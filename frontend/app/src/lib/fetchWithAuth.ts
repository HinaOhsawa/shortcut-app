// src/lib/fetchWithAuth.ts
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  let accessToken = localStorage.getItem("accessToken");
  const refreshToken = localStorage.getItem("refreshToken");

  // Authorization ヘッダーを追加
  options.headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${accessToken}`,
  };

  let res = await fetch(url, options);

  // 401 かつ refreshToken がある場合はトークン更新
  if (res.status === 401 && refreshToken) {
    const refreshRes = await fetch(
      "http://localhost:8000/api/accounts/token/refresh/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refreshToken }),
      }
    );

    if (!refreshRes.ok) {
      throw new Error("Token refresh failed");
    }

    const data = await refreshRes.json();
    accessToken = data.access;
    localStorage.setItem("accessToken", accessToken ?? "");

    // 再度リクエスト
    options.headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${accessToken}`,
    };
    res = await fetch(url, options);
  }

  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }

  return res.json();
}
