# Throttle カウンタの Redis 共有化

## 1. 背景

DRF の `AnonRateThrottle` / `UserRateThrottle` / `ScopedRateThrottle` は、
カウンタを Django の cache backend に保存する。Django のデフォルトは
`LocMemCache`（プロセス内メモリ）であり、本番運用では以下の問題が出る。

### 問題点

- **プロセス間で共有されない**: gunicorn / uwsgi で複数 worker を立てた場合、
  各 worker が独立したカウンタを持つ。実効レートが「設定値 × worker 数」になる。
- **複数サーバ間で共有されない**: ロードバランサ配下では、サーバごとにカウンタが
  独立しているためサーバ数倍まで通る。
- **再起動で消える**: デプロイのたびにブルートフォースカウンタがリセットされ、
  攻撃中なら再開のチャンスを与えてしまう。

## 2. 採用する解

cache backend を Redis に切り替える。Django の cache インタフェースは抽象化
されているため、`CACHES` 設定を変えるだけで DRF Throttle の挙動はそのまま、
カウンタが Redis に乗る。

```
[Worker A] ─┐
[Worker B] ─┼─→ [Redis] ← 単一の真実
[Worker C] ─┘
```

### Redis を採用する理由
- `INCR` がアトミックで race condition に強い
- TTL を Redis 側で自動破棄しメモリリークしない
- 永続化（AOF / RDB）で再起動耐性が得られる
- session / queue / pub-sub にも転用できる汎用基盤

DB cache backend や Memcached でも理論上可能だが、書き込みホットキー特性・
TTL 管理・運用知見の蓄積を考慮すると Redis が事実上のスタンダード。

## 3. 実装内容

### docker-compose.yml
- `redis:7-alpine` サービスを追加
- AOF 永続化を有効化（`--appendonly yes`）
- `redis_data` volume でデータ保持
- backend の `depends_on` と `REDIS_URL=redis://redis:6379/0` を追加

### backend/requirements.txt
- `django-redis>=5.4` を追加

### backend/config/settings.py
```python
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "IGNORE_EXCEPTIONS": True,
        },
        "KEY_PREFIX": "shortcut",
    }
}
```

DRF 側に変更不要。`AnonRateThrottle` 等の throttle classes が `cache.get_or_set`
を経由してカウンタを読み書きする全ての操作が Redis に向く。

## 4. 設計判断

### IGNORE_EXCEPTIONS=True（fail-open）を採用
Redis 接続失敗時に throttle を諦めてリクエストを通す。
- **採用理由**: throttle はサービス維持の補助機能であり、Redis 障害で全 API が
  503 になる方がビジネス影響が大きい。
- **トレードオフ**: 障害中はブルートフォース耐性が下がる。セキュリティ重視なら
  False（fail-close）にする運用も妥当。認証系だけ別 backend にするハイブリッドも可。

### KEY_PREFIX="shortcut"
複数アプリで同じ Redis インスタンスを共有する場合のキー衝突を防ぐ。
将来 session / queue 用途に Redis を拡張しても名前空間が分離される。

### 永続化を有効化
レート制限カウンタは短命（1 分 TTL）だが、攻撃中の Redis 再起動で
カウンタがリセットされるとそのタイミングで攻撃が再開できてしまう。
AOF 有効で書き込み耐久性を確保する。

## 5. テスト戦略

`backend/accounts/tests.py::ThrottleTests` で以下を検証:

- `auth` scope (10/min) を 11 回叩いて 429 が返ること
- `register` scope (5/min) を 6 回叩いて 429 が返ること
- `cache.clear()` でカウンタがリセットされ、再びリクエストが通ること

各テストの setUp で `cache.clear()` を呼び、テスト間でカウンタが
干渉しないようにする（Redis の真の挙動を検証する目的では適切）。

## 6. 本番運用の注意

### REDIS_URL の差し替え
- AWS: ElastiCache for Redis のエンドポイントへ
- Upstash 等のサーバレス Redis: TLS 接続のため `rediss://` を使う
- 認証付き Redis: `redis://:password@host:6379/0`

### 監視項目
- Redis のメモリ使用量（throttle key は短命なので軽いが、他用途と共有時に注意）
- 接続失敗率（`IGNORE_EXCEPTIONS=True` だと 500 にならず throttle が
  実質無効化される。アプリケーションログでの可視化が必要）
- `INFO` コマンドの `connected_clients` で Django worker 数 × 接続が立つことを確認

### 暫定的な fail-close オプション
セキュリティ要件が高まった場合、認証系エンドポイントだけ専用の throttle
class を作り、cache 不通時に 503 を返す実装も可能。本対応の範囲外。
