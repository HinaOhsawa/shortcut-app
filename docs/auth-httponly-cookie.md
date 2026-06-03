# 認証アーキテクチャ: HttpOnly Cookie 移行設計

## 1. 背景と目的

### 現状の課題
JWT (access / refresh) をフロントエンドの `localStorage` に保存している。
- XSS で JavaScript が任意実行されるとトークンが盗まれる（`localStorage.getItem` で誰でも読める）
- 一度盗まれた refresh は最大 7 日間有効で、サーバ側からは攻撃者の正規アクセスと区別できない

### 目的
JWT を HttpOnly Cookie に移し、JavaScript からのトークン読み取りを物理的に不可能にする。

### 非目的
- JWT 自体の置換（OAuth / セッション認証への移行）
- マルチデバイスログアウト機能
- リフレッシュトークンファミリー（同一トークンの複数派生検知）

---

## 2. アーキテクチャ概要

```
[Browser]
   │  https://app.example.com/api/...
   ▼
[Next.js (rewrites)]  ←── 同一オリジン
   │  proxy: http://backend:8000/api/...
   ▼
[Django REST Framework]
   │  Cookie: access_token / refresh_token / csrftoken
   ▼
[CookieJWTAuthentication]
```

**鍵となる設計判断**: フロントエンドと API を **同一オリジン** にする。
Next.js の `rewrites` で `/api/*` を Django に内部プロキシすることで、ブラウザから見ると全て `localhost:3000`（dev）/ `app.example.com`（prod）への同一オリジンリクエストとなる。

これにより:
- Cookie の SameSite=Lax でフル機能（CORS 不要）
- 設定が dev / prod で同一構造
- CSRF 対策が Django 標準のまま適用可能

---

## 3. Cookie 設計

| Cookie 名 | HttpOnly | Secure (prod) | SameSite | Path | Max-Age | 用途 |
|---|---|---|---|---|---|---|
| `access_token` | ✓ | ✓ | Lax | `/` | 15 min | API 認証用 JWT |
| `refresh_token` | ✓ | ✓ | Lax | `/api/accounts/` | 7 days | アクセストークン更新用 |
| `csrftoken` | ✗ | ✓ | Lax | `/` | session | CSRF 二重送信用（JS から読む） |

### 設計理由
- **HttpOnly**: JavaScript からアクセス不可 → XSS でトークン窃取不可
- **Secure (prod)**: HTTPS 経由でのみ送信。dev は HTTP 許容のため `DEBUG=False` 時のみ
- **SameSite=Lax**: 同一サイトのリクエストにのみ自動付与。CSRF を構造的に低減
- **refresh の Path 制限**: `/api/accounts/` に限定して攻撃面を最小化（access endpoint の方が広い path）
- **csrftoken は HttpOnly でない**: JavaScript が読んで `X-CSRFToken` ヘッダで送り返す必要があるため

---

## 4. CSRF 対策

Cookie ベース認証では CSRF が必須となる（攻撃者サイトからの fetch でも Cookie が自動付与されるため）。

### 採用方式: Django 標準の double-submit cookie パターン
1. Django が `csrftoken` Cookie を発行（non-HttpOnly）
2. 安全でないメソッド（POST / PUT / PATCH / DELETE）では、フロントが Cookie を読んで `X-CSRFToken` ヘッダに設定
3. サーバはヘッダと Cookie の値が一致するかを検証

### なぜ機能するか
- 同一オリジンのスクリプトは `csrftoken` Cookie を `document.cookie` 経由で読める
- 攻撃者サイト（クロスオリジン）のスクリプトは Cookie を読めない（Same-Origin Policy）
- 攻撃者は Cookie 値を知れないため、`X-CSRFToken` ヘッダを正しい値で立てられない
- カスタムヘッダ付き fetch は CORS preflight が走るため、ヘッダ検証が事前に行われる

### 実装ポイント
- DRF のデフォルトでは `JWTAuthentication` は CSRF を強制しない
- 自前の `CookieJWTAuthentication` で `enforce_csrf(request)` を unsafe メソッドに対して呼び出す
- フロントエンドの `fetchWithAuth` で `csrftoken` Cookie を読み `X-CSRFToken` ヘッダを自動付与

---

## 5. エンドポイント設計の変化

| エンドポイント | リクエスト変化 | レスポンス変化 |
|---|---|---|
| `POST /api/accounts/register/` | 同じ（name/email/password） | Body から token 削除 → Set-Cookie で返す |
| `POST /api/accounts/login/` | 同じ（email/password） | Body から token 削除 → Set-Cookie で返す。user 情報のみ Body |
| `POST /api/accounts/token/refresh/` | Body 不要 → Cookie から読む | refresh_token Cookie を再発行（rotation） |
| `POST /api/accounts/logout/` | Body 不要 → Cookie から読む | Set-Cookie で空値+Max-Age=0 を返してクリア |
| `GET /api/accounts/profile/` | 変化なし | 変化なし。`@ensure_csrf_cookie` で csrftoken Cookie を確実に発行 |
| その他の API | Authorization ヘッダ廃止 → access_token Cookie で認証 | 変化なし |

---

## 6. 実装コンポーネント

### Backend

```
backend/
└── accounts/
    ├── authentication.py    # 新規: CookieJWTAuthentication
    ├── cookies.py           # 新規: set_auth_cookies / clear_auth_cookies ユーティリティ
    ├── views.py             # 修正: Login/Register/Logout/Refresh の Cookie 対応
    └── urls.py              # 修正: refresh ビューを Cookie 版に差し替え
```

### Frontend

```
frontend/app/
├── next.config.ts                       # 修正: rewrites で /api/* を backend に
└── src/
    ├── lib/
    │   ├── apiBase.ts                   # 修正: 相対パス /api/... に
    │   ├── csrf.ts                      # 新規: csrftoken Cookie 取得
    │   ├── fetchWithAuth.ts             # 修正: localStorage/Bearer 廃止、CSRF 付与
    │   ├── login.ts                     # 修正: token 受け取り削除、credentials: include
    │   └── signup.ts                    # 修正: 同上
    ├── components/
    │   ├── RequireAuth.tsx              # 修正: profile エンドポイントヒットチェック
    │   └── SignOutButton.tsx            # 修正: localStorage 削除を廃止
    └── app/
        └── signin/page.tsx              # 修正: localStorage 保存を廃止
```

---

## 7. セキュリティ プロパティ

### 移行前 (localStorage)
| 攻撃 | 影響 |
|---|---|
| XSS | access + refresh が両方流出 → 7日間なりすまし可能 |
| CSRF | Bearer ヘッダは自動付与されないため低 |
| MITM (HTTP) | 経路上で全トークン傍受可能 |

### 移行後 (HttpOnly Cookie + CSRF)
| 攻撃 | 影響 |
|---|---|
| XSS | Cookie は読めない。攻撃者がページ内で fetch できる範囲のみ被害（同セッション中の操作）。トークン自体は持ち出せない |
| CSRF | Django CSRF middleware + 自前 enforce_csrf で防御 |
| MITM (HTTPS) | Secure Cookie のため HTTPS 必須化。dev は HTTP 許容（Secure を外す） |

XSS に対しては「根絶」ではなく「被害の局所化」が達成できる。
完全な XSS 根絶には CSP（Content Security Policy）が別途必要だが、本対応の範囲外。

---

## 8. テスト戦略

### 既存テストへの影響
- `force_authenticate(user=...)` を使うテストは認証パスを bypass するため影響なし
- `client.post("/api/accounts/login/", ...)` 後に `res.data["access"]` を読んでいる箇所は、Body から token を取り除くため修正必要
- DRF `APIClient` は `enforce_csrf_checks=False`（デフォルト）で `_dont_enforce_csrf_checks` フラグが立つため、`enforce_csrf` も skip される → CSRF ヘッダ無しでも通る

### 追加するテスト
- ログイン成功時に `access_token` / `refresh_token` / `csrftoken` Cookie が Set-Cookie で返ること
- ログアウト後に Cookie がクリア（Max-Age=0）されていること
- access_token Cookie が無効な場合に 401 が返ること
- refresh エンドポイントが Cookie から refresh を読み、新しい access Cookie を発行すること
- CSRF を強制するために `enforce_csrf_checks=True` でクライアントを作成し、CSRF ヘッダ未送信で 403 が返ること

---

## 9. 移行とロールアウト

### 互換性
- フロントエンド・バックエンドの両方を一斉に切り替える破壊的変更
- 旧バージョンのフロントエンドからの Bearer リクエストは 401 になる（受け入れる）
- 既にサインイン済みのユーザーは強制ログアウト（localStorage に持っている古いトークンは新サーバで無効）

### デプロイ順
1. バックエンドのみ先行デプロイした場合、フロントエンドは Bearer で送り続けて全エンドポイントが 401
2. 同時デプロイ必須

### ロールバック
- ブランチ単位で revert 可能
- DB スキーマ変更なし（token_blacklist テーブルは既存のまま）

---

## 10. 残課題（本対応外）

- **CSP**: XSS 経路自体を CSP で塞ぐ。`script-src 'self'` を最低限とし徐々に厳格化
- **マルチデバイスログアウト**: 全デバイスでサインアウトする UI（refresh blacklist の全消去）
- **Token binding / DPoP**: トークンとクライアント鍵の結合（高度な対策、現時点では不要）
- **Session activity tracking**: 異常ログイン検知（地理的・時間的）
