# ショートカットアプリ 仕様書

## 📋 プロジェクト概要

開発者がよく使うショートカットキーをアプリケーション別・カテゴリ別に整理・管理し、共有・参照できるWebアプリケーション。

---

## 🎯 主要機能

### 1. ユーザー認証・管理
- **ユーザー登録**: メールアドレス+パスワードで新規登録
- **ログイン**: JWT Token 認証
- **プロフィール管理**: ユーザー名、メール、パスワード変更
- **セッション管理**: Token の有効期限と更新

### 2. ショートカット管理（3階層構造）

#### Application（アプリケーション）
- 用途別のグループ (例: VS Code、Chrome、IDE)
- ユーザーごとに複数作成可
- 属性:
  - `id`: UUID
  - `name`: アプリケーション名 (max 100)
  - `user`: 所有ユーザー
  - `created_at`, `updated_at`: タイムスタンプ
  - 制約: ユーザーごとに同じ名前は不可

#### Category（カテゴリ）
- アプリケーション内での分類 (例: 編集、ナビゲーション)
- ユーザー全体で複数作成可
- 属性:
  - `id`: UUID
  - `name`: カテゴリ名 (max 50, デフォルト: "未分類")
  - `sort_order`: 並び順
  - `user`: 所有ユーザー
  - 制約: ユーザーごとに同じ名前は不可

#### Shortcut（ショートカット）
- 個別のキーバインド設定
- 属性:
  - `id`: UUID
  - `command_name`: コマンド名 (max 100)
  - `shortcut_key`: キーバインド (max 50, 例: "Ctrl+K")
  - `note`: メモ・説明 (テキスト型)
  - `sort_order`: 表示順序
  - `user`: 所有ユーザー
  - `app`: 関連アプリケーション (デフォルト: "Untitled")
  - `category`: 関連カテゴリ (デフォルト: "未分類")
  - `created_at`, `updated_at`: タイムスタンプ
  - 制約: ユーザー+アプリ+コマンド名+キーバインド の組み合わせは一意

### 3. データ権限管理
- **認証必須**: すべてのショートカット取得・作成は JWT Token 必須
- **ユーザー分離**: ログイン中のユーザーのデータのみ取得可能
- **自動アサイン**: ショートカット作成時にデフォルトアプリ・カテゴリを自動セット

---

## 🔗 API エンドポイント

### 認証関連
| メソッド | エンドポイント | 説明 |
|---------|-------------|------|
| POST | `/api/accounts/register/` | ユーザー登録 |
| POST | `/api/accounts/login/` | ログイン |
| POST | `/api/accounts/token/` | Token 取得（JWT） |
| POST | `/api/accounts/token/refresh/` | Token 更新 |
| GET | `/api/accounts/profile/` | プロフィール取得 |

### ショートカット関連
| メソッド | エンドポイント | 説明 |
|---------|-------------|------|
| GET | `/api/shortcuts/` | ショートカット一覧取得 |
| POST | `/api/shortcuts/` | ショートカット作成 |
| GET | `/api/shortcuts/{id}/` | ショートカット詳細取得 |
| PUT/PATCH | `/api/shortcuts/{id}/` | ショートカット更新 |
| DELETE | `/api/shortcuts/{id}/` | ショートカット削除 |

---

## 🖼️ フロントエンド画面

### 公開ページ（未ログイン）
ヘッダーのみのシンプルレイアウト。

| ページ | パス | 説明 |
|-------|------|------|
| ホーム | `/` | サービス紹介・サインイン導線 |
| 登録 | `/signup/` | ユーザー登録画面 |
| ログイン | `/signin/` | ログイン画面 |

### 認証後ページ（ログイン後）
`(main)` ルートグループに配置し、共通レイアウト [`(main)/layout.tsx`](../frontend/app/src/app/(main)/layout.tsx) で **サイドメニュー（[Sidebar](../frontend/app/src/components/Sidebar.tsx)）を全画面に表示**。ログイン直後は `/dashboard` に遷移する。

| ページ | パス | 説明 |
|-------|------|------|
| ダッシュボード | `/dashboard/` | ショートカット数・アプリ数・カテゴリ数のサマリ。ログイン直後の遷移先 |
| ショートカット一覧 | `/shortcuts/` | ショートカット一覧・登録・編集・削除。`?app=`/`?category=` で絞り込み |
| アプリ一覧 | `/applications/` | アプリ（Application）の一覧・管理 |
| カテゴリ一覧 | `/categories/` | カテゴリ（Category）の一覧・管理 |
| プロフィール | `/profile/` | プロフィール管理画面 |

---

## 🛠️ 技術スタック

### Backend
- **Framework**: Django 4.2 + Django REST Framework
- **Database**: PostgreSQL 15
- **Authentication**: JWT (djangorestframework-simplejwt)
- **CORS**: django-cors-headers

### Frontend
- **Framework**: Next.js 15.5 + React 19
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **Forms**: React Hook Form + Zod
- **Icons**: Lucide React

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Database Port**: 5432
- **Backend Port**: 8000
- **Frontend Port**: 3000

---

## 📊 データモデル図

```
User (CustomUser)
  ├── Applications (1:N)
  │   └── Shortcuts (1:N)
  ├── Categories (1:N)
  │   └── Shortcuts (1:N)
  └── Shortcuts (1:N)
```

---

## 🔐 セキュリティ

- **認証**: JWT Token ベース
- **認可**: ユーザーは自分のデータのみアクセス可
- **CORS**: フロントエンドからのリクエストを許可
- **パスワード**: Django の標準ハッシュ化

---

## 📝 現状の実装状況

✅ **完了**
- ユーザー認証（登録、ログイン、プロフィール）
- モデル設計（Application、Category、Shortcut）
- API 基本構造
- Docker 環境構築
- フロントエンド基本構造

⏳ **未実装・要改善**
- フロントエンドの詳細UI（一覧表示、編集機能）
- ショートカット検索・フィルター機能
- エラーハンドリングの充実
- テストコードの作成
- ドキュメント自動生成
