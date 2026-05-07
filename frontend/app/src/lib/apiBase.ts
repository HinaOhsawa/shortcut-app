// API ベース URL は環境変数 NEXT_PUBLIC_API_BASE_URL から取得する
// 未設定時は localhost にフォールバック（dev 用）
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export function apiUrl(path: string): string {
  const trimmed = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${trimmed}`;
}
