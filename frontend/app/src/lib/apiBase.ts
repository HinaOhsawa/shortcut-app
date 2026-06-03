// API は Next.js の rewrites 経由で同一オリジンとして叩く。
// 相対パスを使うことでブラウザから見て常に Same-Origin になり、
// HttpOnly Cookie + CSRF を自然に機能させられる。
export function apiUrl(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}
