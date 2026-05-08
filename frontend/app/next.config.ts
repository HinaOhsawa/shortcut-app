import type { NextConfig } from "next";

// Next.js サーバから Django にプロキシする際の内部接続先。
// Docker 構成では backend サービス名、ローカル dev では localhost を指す。
// クライアントには露出させないため NEXT_PUBLIC_ プリフィックスを付けない。
const API_ORIGIN =
  process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  // Docker イメージを最小化するため standalone 出力を使う。
  // .next/standalone に必要最小限のファイルが集まる。
  output: "standalone",
  // Django は末尾スラッシュ付き URL を要求するため、Next.js のデフォルト
  // 「trailing slash → リダイレクト」挙動を /api 経路で有効化させない。
  skipTrailingSlashRedirect: true,
  // /api/* を Django にプロキシして同一オリジン化する。
  // これによりブラウザからは全てのリクエストが同じオリジンに見え、
  // HttpOnly Cookie + SameSite=Lax + CSRF が自然に機能する。
  async rewrites() {
    return [
      {
        // Next.js の :path* は trailing slash を捕捉しないため、Django が要求する
        // 末尾スラッシュを destination 側で必ず付与する。
        source: "/api/:path*",
        destination: `${API_ORIGIN}/api/:path*/`,
      },
    ];
  },
};

export default nextConfig;
