# メールアドレス検証フロー 仕様

## 1. 背景と目的

### 現状の課題
登録時にメールアドレスを受け取り JWT を発行しているが、**メールアドレスの実在確認をしていない**。

- 他人のメールアドレスで登録されると、後でその人がアカウントを作成しようとしたときに「既に登録済み」エラーで詰む
- 不正登録（タイポ、悪意ある乗っ取り未遂）の検出ができない
- パスワードリセット機能を後で追加する際に、「リセットメール送信先＝そもそも本人でない可能性」という穴ができる

### 目的
登録メールアドレスの所有確認を義務化する。

### 非目的
- 携帯電話番号 SMS 認証
- 二要素認証（TOTP / WebAuthn 等）
- メールアドレス変更フロー（別タスク）
- ソーシャルログイン

---

## 2. UX 方針

### 採用方針: ソフト要求型
登録直後はログイン可能だが、**未確認状態の表示** とログイン後の **確認再送 UI** を出す。
未確認のままでもショートカットの作成・閲覧は可能。

### 理由
- 学習用の個人プロジェクトであり、即時利用を阻害したくない
- 登録 → メール開く → クリック → アプリ復帰 のフローはモバイルで特に摩擦が大きい
- セキュリティ上も「未確認 = 不便な状態を放置するインセンティブ」で十分機能する

### 将来的にハード要求化したい場合
`is_email_verified=False` のユーザーに対して特定の API を 403 にするだけで切り替え可能になるよう、フィールド設計をしておく（後述）。

---

## 3. データモデル

### `accounts.CustomUser` への追加フィールド

```python
class CustomUser(...):
    # 既存フィールド
    is_email_verified = models.BooleanField(default=False)
    # email_verified_at は監査ログ・サポート問合せに有用
    email_verified_at = models.DateTimeField(null=True, blank=True)
```

### 検証トークン: `accounts.EmailVerificationToken`

```python
class EmailVerificationToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE,
                             related_name="email_verification_tokens")
    # トークン本体は DB に平文保存しない（漏洩時の被害最小化）。
    # 代わりに sha256 ハッシュを保存。
    token_hash = models.CharField(max_length=64, db_index=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "email_verification_tokens"
        indexes = [models.Index(fields=["token_hash"])]
```

### 設計理由

- **トークンは hash 保存**: パスワードリセットや他アプリでも標準的なパターン。DB 漏洩時に未使用トークンが盗まれて悪用されるのを防ぐ
- **expires_at**: 24 時間で失効
- **used_at**: 使用済みフラグ（再利用攻撃の防止）
- **同一ユーザーに対する複数トークン**: 「再送」時に古いトークンを無効化するのではなく、新しい行を追加して古いものは使用済み扱いにする

---

## 4. エンドポイント

| メソッド | パス | 認証 | 用途 |
|---|---|---|---|
| POST | `/api/accounts/register/` | 不要 | 既存。登録成功時に検証メール送信を追加 |
| POST | `/api/accounts/verify-email/` | 不要 | トークン文字列を受け取り検証 |
| POST | `/api/accounts/resend-verification/` | 必要 | ログイン中ユーザーに再送（throttle あり） |

### `POST /api/accounts/verify-email/`
- Body: `{"token": "<plaintext-token>"}`
- 200: `{"detail": "メールアドレスが確認されました。"}`
- 400: トークンが無効・期限切れ・使用済み
- 副作用: `user.is_email_verified=True`, `user.email_verified_at=now()`, `token.used_at=now()`

### `POST /api/accounts/resend-verification/`
- Body 不要（認証ユーザーから取得）
- 200: `{"detail": "確認メールを送信しました。"}`
- 既に確認済みなら 400
- throttle: `email_send` scope で 3/hour（連続送信を防止）

### `GET /api/accounts/profile/` の拡張
- 既存の `id`/`email`/`name` に加え `is_email_verified` を返す（フロントが UI 出し分けに使う）

---

## 5. メール送信基盤

### 抽象化レイヤ
`accounts/email.py` に薄いユーティリティを置き、Django の `send_mail` を呼ぶ。

### 開発環境
`EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend`
- メールはコンソールに出力されるだけで実送信されない
- 検証中はコンソールから検証 URL をコピーしてブラウザに貼る

### 本番環境
`EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend`
- SMTP 設定（`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`）を env で
- 送信先: SendGrid / Postmark / Amazon SES のいずれか（具体は運用判断）

### From アドレス
`DEFAULT_FROM_EMAIL` を env で設定。

---

## 6. メール本文

プレーンテキスト（HTML マルチパート対応は将来）。

```
件名: [ShortcutApp] メールアドレスの確認をお願いします

{name} 様

ShortcutApp にご登録いただきありがとうございます。
以下の URL を 24 時間以内にクリックして、メールアドレスを確認してください。

{verification_url}

このメールに心当たりがない場合は無視してください。
```

`verification_url` の形式: `{frontend_origin}/verify-email?token=<plaintext-token>`

frontend_origin は env `FRONTEND_ORIGIN`（dev: `http://localhost:3000`、本番: 実ドメイン）。

---

## 7. フロントエンド

### `/verify-email` ページ
- クエリ `?token=<...>` を取得
- マウント時に `POST /api/accounts/verify-email/` を呼ぶ
- 結果を表示:
  - 成功: 「確認しました」+ ダッシュボードへのリンク
  - 失敗: エラーメッセージ + 再送 CTA（要ログイン）

### サインイン後のバナー
未確認ユーザーに対して、ダッシュボード等で「メールアドレスがまだ確認されていません」+ 「再送する」ボタンを表示。
- ボタン → `POST /api/accounts/resend-verification/`
- 完了後に「送信しました」トースト

### `RequireAuth` の挙動は変えない
未確認でもログインは可能（ソフト要求方針）。

---

## 8. セキュリティ プロパティ

| 攻撃 / リスク | 対策 |
|---|---|
| トークン総当たり | トークン長 32 byte (256 bit) で総当たり不可。throttle で送信回数制限 |
| 期限切れトークン悪用 | 24h 失効、使用済みフラグで再利用不可 |
| DB 漏洩でトークン流出 | トークンは hash 保存、平文は失効 |
| ユーザー存在情報の漏洩 | `resend` は認証必須なので問題なし。`verify` のエラーメッセージで「ユーザーが存在しない」とは返さず「無効なトークン」で統一 |
| メール乗っ取りで第三者が確認 | 本機能の範疇外（メール経路の信頼に乗る） |
| 送信先メアドの誤入力 | 確認しないと使い始められないわけではないため致命的ではない。ユーザーがプロフィール画面でメール変更可能にする（将来） |

---

## 9. テスト戦略

### Backend
- `/register/` 時に検証メールが（`mail.outbox` 経由で）1 通送信されること
- 有効トークンで `/verify-email/` が 200、`is_email_verified=True` になること
- 期限切れトークンは 400
- 使用済みトークンの再利用は 400
- 別ユーザーのトークンでは検証されないこと
- `/resend-verification/` が新トークンを生成しメールを 1 通追加すること
- `/resend-verification/` が既に確認済みユーザーで 400 を返すこと
- `email_send` scope の throttle が 4 回目で 429 を返すこと

### Frontend
- スコープ外（手動確認）

---

## 10. 移行とロールアウト

### 既存ユーザー
データマイグレーションで `is_email_verified=True` を一括設定する選択肢:

- **A. 既存全員を verified 扱い**: 互換性を最優先。本機能の効果は新規ユーザーから
- **B. 既存全員を unverified 扱い + 1 度だけ確認メール送信**: 厳密だが大量送信が発生

開発初期で運用ユーザーが少ないため **A を採用**。マイグレーションで `is_email_verified=True` をセットする。

### 環境変数（本対応で追加）
- `EMAIL_BACKEND` (dev: console, prod: smtp)
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`
- `DEFAULT_FROM_EMAIL`
- `FRONTEND_ORIGIN`
- `EMAIL_VERIFICATION_TOKEN_LIFETIME_HOURS`（デフォルト 24）

---

## 11. パスワードリセットとの関係

別途 [docs/password-reset.md] で扱う（未作成）。
両者は以下を共有する:

- メール送信基盤（本対応で確立）
- トークンは hash 保存パターン（共通設計）
- throttle scope（`email_send`）の活用

そのため本タスクで先にメール基盤を整え、パスワードリセットはその上に乗る形で実装する。
