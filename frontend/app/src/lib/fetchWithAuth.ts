// src/lib/fetchWithAuth.ts
// HttpOnly Cookie ベース認証用の fetch ラッパー。
// access_token / refresh_token はサーバが Cookie で管理するため
// クライアントから明示的にトークンを扱う必要はない。
// 安全でないメソッドには csrftoken Cookie の値を X-CSRFToken ヘッダで添える。

import { apiUrl } from "@/lib/apiBase";
import { isUnsafeMethod, readCsrfToken } from "@/lib/csrf";

function redirectToSignin(): Promise<never> {
  if (typeof window !== "undefined") {
    if (window.location.pathname !== "/signin") {
      window.location.href = "/signin";
    }
  }
  return new Promise<never>(() => {});
}

function buildHeaders(method: string, init: HeadersInit | undefined): HeadersInit {
  const headers: Record<string, string> = {
    ...(init as Record<string, string> | undefined),
  };
  if (isUnsafeMethod(method)) {
    const csrf = readCsrfToken();
    if (csrf) {
      headers["X-CSRFToken"] = csrf;
    }
  }
  return headers;
}

async function refreshAccessToken(): Promise<boolean> {
  const res = await fetch(apiUrl("/api/accounts/token/refresh/"), {
    method: "POST",
    credentials: "same-origin",
    headers: buildHeaders("POST", { "Content-Type": "application/json" }),
  });
  return res.ok;
}

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const method = options.method ?? "GET";
  const requestInit: RequestInit = {
    ...options,
    credentials: "same-origin",
    headers: buildHeaders(method, options.headers),
  };

  let res = await fetch(url, requestInit);

  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      return redirectToSignin();
    }
    // refresh が成功したら新しい access_token Cookie で再試行
    res = await fetch(url, {
      ...options,
      credentials: "same-origin",
      headers: buildHeaders(method, options.headers),
    });
  }

  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}
