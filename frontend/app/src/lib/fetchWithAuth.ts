// src/lib/fetchWithAuth.ts
function redirectToSignin(): Promise<never> {
  if (typeof window !== "undefined") {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    if (window.location.pathname !== "/signin") {
      window.location.href = "/signin";
    }
  }
  // ページ遷移完了まで呼び出し元を待機させ、例外ノイズを抑止する
  return new Promise<never>(() => {});
}

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const accessToken =
    typeof window !== "undefined"
      ? localStorage.getItem("accessToken")
      : null;
  const refreshToken =
    typeof window !== "undefined"
      ? localStorage.getItem("refreshToken")
      : null;

  options.headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${accessToken}`,
  };

  let res = await fetch(url, options);

  if (res.status === 401) {
    if (!refreshToken) {
      return redirectToSignin();
    }

    const refreshRes = await fetch(
      "http://localhost:8000/api/accounts/token/refresh/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refreshToken }),
      }
    );

    if (!refreshRes.ok) {
      return redirectToSignin();
    }

    const data = await refreshRes.json();
    const newAccessToken = data.access;
    localStorage.setItem("accessToken", newAccessToken ?? "");

    options.headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${newAccessToken}`,
    };
    res = await fetch(url, options);
  }

  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}
