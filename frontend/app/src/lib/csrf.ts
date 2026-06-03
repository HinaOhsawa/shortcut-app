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

// 公開エンドポイント（login/signup/forgot-password 等）でも、
// 既存の access_token cookie が残っている状態だとサーバが CSRF を強制するため、
// csrftoken cookie が読めれば常に X-CSRFToken を添えておく。
export function withCsrfHeader(headers: Record<string, string> = {}): Record<string, string> {
  const csrf = readCsrfToken();
  return csrf ? { ...headers, "X-CSRFToken": csrf } : headers;
}
