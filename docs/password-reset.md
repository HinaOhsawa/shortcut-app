# パスワードリセットフロー 仕様

## 1. 背景と目的

### 現状の課題
ユーザーがパスワードを忘れた場合の復旧手段が無い。
- サインインに失敗し続けるとアプリから締め出される
- サポートに依頼する経路もないため詰む

### 目的
登録メールアドレス経由でパスワードを再設定するフローを提供する。

### 非目的
- 秘密の質問
- SMS / 電話による復旧
- 管理者によるパスワード強制リセット
- 既存セッションの即時無効化（リセット時の selective invalidation は対応するが、UI からの「全デバイスログアウト」は別タスク）

---

## 2. UX 方針

### フロー全体
1. サインイン画面に「パスワードをお忘れですか？」リンク
2. メールアドレス入力フォーム → リセット要求
3. **常に同じ成功メッセージを返す**（"登録があれば送信しました"）
4. ユーザーがメールのリンクをクリック → 新パスワード入力ページへ
5. 新パスワードと確認用パスワードを入力 → 送信
6. 成功 → サインインページへ誘導

### 採用する設計判断
- **ユーザー存在の有無を返さない**: メールアドレスの登録有無を漏らすと列挙攻撃に使われる
- **トークン使用後に**: refresh トークンを全 blacklist してリセット元アカウントの既存セッションを切る
- **メール認証済みかは問わない**: 未確認ユーザーもリセット可能（被害最小化）

---

## 3. データモデル

### `accounts.PasswordResetToken`

メール認証用の `EmailVerificationToken` と構造が完全に並行するため、命名と方針を揃える。

```python
class PasswordResetToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE,
                             related_name="password_reset_tokens")
    token_hash = models.CharField(max_length=64, db_index=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "password_reset_tokens"
        indexes = [models.Index(fields=["token_hash"])]
```

### 設計理由
- メール認証と同じ「平文未保存・hash 保存」「expires_at + used_at」パターン
- 差分は **有効期限が短い**（1 時間）こと。第三者がメールを覗き見るリスクを最小化
- 既存トークンを発行時に無効化はしない（再送 = 新トークン追加）。古いトークンも有効期間内は使えるが、used_at で一回限りなので実害なし

---

## 4. エンドポイント

| メソッド | パス | 認証 | 用途 |
|---|---|---|---|
| POST | `/api/accounts/password-reset/request/` | 不要 | メールアドレスを受け取り、登録があればリセットメールを送信 |
| POST | `/api/accounts/password-reset/confirm/` | 不要 | トークン + 新パスワードを受け取り、検証して更新 |

### `POST /api/accounts/password-reset/request/`
- Body: `{"email": "user@example.com"}`
- レスポンス: **常に 200**「登録があれば送信しました」（`{"detail": "リセットメールを送信した可能性があります。受信箱をご確認ください。"}`）
- throttle: `email_send` scope（既存定義: 3/hour）
- 副作用:
  - 該当ユーザーが存在すれば `PasswordResetToken` を発行しメール送信
  - 存在しなくても処理時間を一定にするためダミー作業を入れる（タイミング攻撃対策）

### `POST /api/accounts/password-reset/confirm/`
- Body: `{"token": "<plaintext>", "new_password": "<new>"}`
- 200: `{"detail": "パスワードを更新しました。"}`
- 400: トークンが無効・期限切れ・使用済み、もしくはパスワード強度不足
- throttle: `auth` scope（既存定義: 10/min）。トークン総当たり対策
- 副作用:
  - `user.set_password()` で更新
  - `PasswordResetToken.used_at = now()`
  - **同ユーザーの全 refresh token を blacklist**（リセット元の他デバイス強制ログアウト）

---

## 5. メール本文

```
件名: [ShortcutApp] パスワード再設定のご案内

{name} 様

ShortcutApp のパスワード再設定のリクエストを受け付けました。
以下の URL を 1 時間以内にクリックして、新しいパスワードを設定してください。

{reset_url}

このメールに心当たりがない場合は無視してください。リクエストは時間経過で無効になります。
```

`reset_url`: `{frontend_origin}/password-reset/confirm?token=<plaintext-token>`

---

## 6. フロントエンド

### `/forgot-password` ページ
- メールアドレス入力フォーム + 送信
- 送信後は「送信しました」メッセージのみ表示（成功/失敗区別しない）
- サインインへのリンク

### サインイン画面の追加リンク
「パスワードをお忘れですか？」→ `/forgot-password`

### `/password-reset/confirm` ページ
- クエリ `?token=<...>` を取得
- 新パスワード入力フォーム + 確認用フォーム
- React Hook Form + zod でクライアント側バリデーション
- 送信成功 → 「更新しました」+ サインインへの導線
- トークン無効/期限切れ → エラー表示 + 「リセットを再要求」CTA

---

## 7. セキュリティ プロパティ

| 攻撃 / リスク | 対策 |
|---|---|
| メールアドレス列挙 | request エンドポイントは存在/非存在を区別せず常に 200 |
| タイミング攻撃でアドレス推定 | request 処理時間を均す（パスワードハッシュ生成相当のダミー処理） |
| トークン総当たり | 32 byte 長 + `auth` throttle 10/min |
| 期限切れ・再利用攻撃 | 1h で失効、used_at で再利用不可 |
| メール乗っ取り | リセット完了で全 refresh blacklist → 既存セッションが不正利用されない |
| パスワード強度不足での更新 | 既存 `validate_password` を再利用 |
| DB 漏洩でトークン悪用 | 平文未保存、sha256 ハッシュのみ |
| CSRF | 既存の Cookie ベース CSRF 防御は未認証エンドポイントには適用されないため、トークン総当たり throttle で代替防御 |

---

## 8. テスト戦略

### Backend
- `request` が登録メールに対して正常にメール送信し 200 を返すこと
- `request` が **未登録メールでも 200** を返し、メール送信は無いこと
- `request` の連発で `email_send` throttle が効くこと
- `confirm` が有効トークン + 強いパスワードで 200、user.password が更新されること
- `confirm` で更新後、リセット元の既存 refresh トークンが blacklist 済みであること
- `confirm` が使用済み・無効・期限切れトークンを 400 で弾くこと
- `confirm` が弱いパスワードを 400 で弾くこと
- `confirm` の連発で `auth` throttle が効くこと

### Frontend
- スコープ外（手動確認）

---

## 9. 既存メール認証フローとの共有

- メール送信基盤（`accounts/email.py`、`EMAIL_BACKEND` 設定、`FRONTEND_ORIGIN`）
- トークン util（`accounts/tokens.py` の `generate_token` / `hash_token`）
- throttle scope（`email_send` 3/hour、`auth` 10/min）

これらは email-verification PR で確立済み。本対応はその上に乗る形で実装する。

---

## 10. 環境変数（本対応で追加）

- `PASSWORD_RESET_TOKEN_LIFETIME_HOURS`（デフォルト 1）

それ以外は email-verification と共用（`EMAIL_BACKEND` / `DEFAULT_FROM_EMAIL` / `FRONTEND_ORIGIN`）。

---

## 11. 移行と互換性

- DB マイグレーション: `PasswordResetToken` テーブル新設のみ。既存データに影響なし
- 既存ユーザーは即座にリセット可能（メール認証済みかは問わない）
- ロールバック: テーブル削除のみで影響なし
