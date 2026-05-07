// Django が発行する csrftoken Cookie を読み取って X-CSRFToken ヘッダで送り返すヘルパー。
// 双方が一致することでサーバ側 CSRF 検証を通過する（double-submit cookie）。

export function readCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isUnsafeMethod(method: string | undefined): boolean {
  return UNSAFE_METHODS.has((method ?? "GET").toUpperCase());
}
