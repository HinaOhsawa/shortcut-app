# AWS App Runner デプロイ手順（学習用、自動 URL）

学習用に AWS にデプロイし、確認後すぐに削除する想定の手順。
東京リージョン（ap-northeast-1）、ドメイン無し（App Runner の自動 URL を使う）。

## 0. 事前準備（一度だけ）

### 0.1. AWS Budgets でアラートを設定（**最初に必ずやる**）

予期しない課金を早期検知するため、$5 でアラート設定。

1. AWS マネジメントコンソール → Billing → Budgets → Create budget
2. **Customize (advanced)** を選択
3. Budget type: **Cost budget**
4. Period: **Monthly**、Recurring
5. Budgeted amount: `$5`
6. Alert threshold:
   - 50% → Email 通知
   - 80% → Email 通知
   - 100% → Email 通知
7. Email address: 受信できるメール

### 0.2. AWS CLI セットアップ

```bash
aws configure
# AWS Access Key ID: <作成しておく>
# AWS Secret Access Key: <作成しておく>
# Default region name: ap-northeast-1
# Default output format: json
```

### 0.3. SES の sandbox 解除を申請（メール送信が必要なら）

SES はデフォルトで sandbox（送信先制限）。解除申請を出して **1〜3 営業日** 待つ。
学習用に sandbox のまま使う場合は、自分のメールアドレスを「Verified Identity」に登録すれば自分宛には送れる。

> **学習だけならメール送信無しでも OK**: `EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend` のままでも他の機能は試せる（メール本文はサーバーログに出る）。

---

## 1. ECR にイメージを push

### 1.1. ECR リポジトリを作る

```bash
aws ecr create-repository --repository-name shortcut-backend --region ap-northeast-1
aws ecr create-repository --repository-name shortcut-frontend --region ap-northeast-1
```

### 1.2. Docker から ECR にログイン

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws ecr get-login-password --region ap-northeast-1 \
  | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com
```

### 1.3. Backend イメージを build & push

App Runner は linux/amd64 で動くため、Apple Silicon (M1/M2/M3) を使っているなら `--platform` 指定が必要。

```bash
cd backend
docker build --platform linux/amd64 -f Dockerfile.prod \
  -t $ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com/shortcut-backend:latest .
docker push $ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com/shortcut-backend:latest
```

### 1.4. Frontend イメージは Backend URL が決まってから build & push

Frontend の `BACKEND_INTERNAL_URL` は build arg として渡す必要がある。
Backend を先にデプロイして URL を取得してから戻ってくる。

---

## 2. RDS PostgreSQL を作成

```bash
aws rds create-db-instance \
  --db-instance-identifier shortcut-app-db \
  --db-instance-class db.t4g.micro \
  --engine postgres \
  --engine-version 16 \
  --allocated-storage 20 \
  --master-username postgres \
  --master-user-password '<安全なパスワード>' \
  --db-name shortcuts \
  --publicly-accessible \
  --backup-retention-period 0 \
  --no-multi-az \
  --no-deletion-protection \
  --region ap-northeast-1
```

> `publicly-accessible` を有効にする理由: App Runner からの接続を VPC Connector を使わず public 経由でやれば、VPC Connector の追加課金や NAT Gateway を避けられる。**学習用途のみ。本番は VPC 配置を推奨**。

起動後に DB エンドポイントを取得:
```bash
aws rds describe-db-instances --db-instance-identifier shortcut-app-db \
  --query 'DBInstances[0].Endpoint.Address' --output text
```

セキュリティグループに 5432 を開ける（**Anywhere は危険、自分の作業時だけ**）:
```bash
SG_ID=$(aws rds describe-db-instances --db-instance-identifier shortcut-app-db \
  --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' --output text)
MY_IP=$(curl -s https://checkip.amazonaws.com)
aws ec2 authorize-security-group-ingress --group-id $SG_ID \
  --protocol tcp --port 5432 --cidr ${MY_IP}/32
```

App Runner 連携時は App Runner の固定 IP が無いため、`0.0.0.0/0` で開ける必要がある（学習用妥協）。
本番はプライベート VPC + VPC Connector で隔離する。

---

## 3. ElastiCache Redis を作成

```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id shortcut-app-redis \
  --cache-node-type cache.t4g.micro \
  --engine redis \
  --num-cache-nodes 1 \
  --region ap-northeast-1
```

ElastiCache は **VPC 内からしか接続できない**（パブリック化不可）ため、App Runner からの接続には VPC Connector が必要。
**学習用途で Redis を省略するなら**:
- `REDIS_URL` を未設定にする（settings.py のフォールバック `redis://localhost:6379/0` だと接続エラーで起動失敗）
- 代わりに `LocMemCache` に切替えるパッチを入れる（throttle が worker 間共有されない欠点あり）

> 学習スコープでは Redis 省略が手軽。本記事の以降は `REDIS_URL` 抜きで進める前提。

---

## 4. SES の Verified Identity 設定（メールを試したい場合）

```bash
aws ses verify-email-identity --email-address your-email@example.com --region ap-northeast-1
```

メールに来る確認リンクをクリック。`DEFAULT_FROM_EMAIL` には verified なアドレスを使う。

---

## 5. Secrets Manager にシークレットを保存

```bash
# Django SECRET_KEY を生成
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")

aws secretsmanager create-secret --name shortcut-app-django-secret \
  --secret-string "$SECRET_KEY" --region ap-northeast-1

aws secretsmanager create-secret --name shortcut-app-db-password \
  --secret-string '<上で設定した DB パスワード>' --region ap-northeast-1
```

> App Runner はランタイム環境変数で Secrets Manager の参照をサポート。
> または直接 env var に値を貼り付けでも動く（学習用は楽）。

---

## 6. Backend を App Runner にデプロイ

### 6.1. App Runner サービスを作成

マネジメントコンソール:
1. App Runner → **Create service**
2. Source: **Container registry**
3. Provider: **Amazon ECR**
4. Container image URI: `$ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com/shortcut-backend:latest`
5. Deployment trigger: Manual（学習用）
6. ECR access role: **Create new service role**
7. Service name: `shortcut-app-backend`
8. CPU: **0.25 vCPU**、Memory: **0.5 GB**（最小、学習用十分）
9. Port: `8080`
10. Environment variables（後で更新もできる）:
    ```
    DJANGO_SECRET_KEY=<上で生成した値>
    DJANGO_DEBUG=False
    DJANGO_ALLOWED_HOSTS=.awsapprunner.com,localhost
    POSTGRES_DB=shortcuts
    POSTGRES_USER=postgres
    POSTGRES_PASSWORD=<DB パスワード>
    POSTGRES_HOST=<RDS エンドポイント>
    POSTGRES_PORT=5432
    CORS_ALLOWED_ORIGINS=<frontend URL を後で追加>
    CSRF_TRUSTED_ORIGINS=<frontend URL を後で追加>
    EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
    DEFAULT_FROM_EMAIL=noreply@example.com
    FRONTEND_ORIGIN=<frontend URL を後で追加>
    ```
    Redis を使わない場合は **`REDIS_URL` を入れない**（後述の追加パッチが必要）。
11. Health check protocol: **HTTP**、Path: `/healthz`、Interval: 10s、Timeout: 5s
12. **Create & deploy**（5〜10 分）

### 6.2. Backend URL を取得

```bash
BACKEND_URL=$(aws apprunner describe-service \
  --service-arn $(aws apprunner list-services \
    --query 'ServiceSummaryList[?ServiceName==`shortcut-app-backend`].ServiceArn' \
    --output text) \
  --query 'Service.ServiceUrl' --output text)
echo "https://$BACKEND_URL"
```

例: `https://abcd1234.ap-northeast-1.awsapprunner.com`

### 6.3. Backend のヘルスチェック確認

```bash
curl https://$BACKEND_URL/healthz
# => {"status": "ok"}
```

---

## 7. Frontend を App Runner にデプロイ

### 7.1. Backend URL を build arg にして再ビルド & push

```bash
cd frontend
docker build --platform linux/amd64 -f Dockerfile.prod \
  --build-arg BACKEND_INTERNAL_URL=https://$BACKEND_URL \
  -t $ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com/shortcut-frontend:latest .
docker push $ACCOUNT_ID.dkr.ecr.ap-northeast-1.amazonaws.com/shortcut-frontend:latest
```

### 7.2. App Runner サービスを作成

Backend と同様の手順で:
- Service name: `shortcut-app-frontend`
- Port: `3000`
- Environment variables:
  ```
  BACKEND_INTERNAL_URL=https://<backend URL>
  NODE_ENV=production
  ```
- Health check Path: `/` (Next.js デフォルトトップページ)

### 7.3. Frontend URL を取得

```bash
FRONTEND_URL=$(aws apprunner describe-service \
  --service-arn $(aws apprunner list-services \
    --query 'ServiceSummaryList[?ServiceName==`shortcut-app-frontend`].ServiceArn' \
    --output text) \
  --query 'Service.ServiceUrl' --output text)
echo "https://$FRONTEND_URL"
```

### 7.4. Backend の env を更新（Frontend URL を反映）

App Runner マネジメントコンソール → backend サービス → Configuration → Edit → 環境変数を更新:

```
CORS_ALLOWED_ORIGINS=https://<frontend URL>
CSRF_TRUSTED_ORIGINS=https://<frontend URL>
FRONTEND_ORIGIN=https://<frontend URL>
```

Backend サービスが自動で再デプロイされる（数分）。

---

## 8. 動作確認

ブラウザで `https://$FRONTEND_URL` を開く:

- [ ] サインアップで新規登録できる
- [ ] HttpOnly Cookie が発行される（DevTools で確認）
- [ ] ログイン・ログアウトできる
- [ ] ショートカット作成・並び替えができる
- [ ] CSRF が機能する（DevTools の Console で `fetch('/api/accounts/logout/', {method: 'POST', credentials: 'same-origin'})` → 403）

---

## 9. **削除手順（学習終了時に必ずやる）**

**重要**: 順番通りに消す。逆順だと依存エラーが出る。

### 9.1. App Runner サービスを削除（一番課金が大きい）

マネジメントコンソール → App Runner → 各サービス → **Actions → Delete service**

または CLI:
```bash
for SVC in shortcut-app-backend shortcut-app-frontend; do
  ARN=$(aws apprunner list-services \
    --query "ServiceSummaryList[?ServiceName=='$SVC'].ServiceArn" --output text)
  aws apprunner delete-service --service-arn $ARN
done
```

### 9.2. RDS インスタンスを削除

**最終スナップショットのチェックを必ず外す**（残ると $0.05/GB-月 が継続）:

```bash
aws rds delete-db-instance \
  --db-instance-identifier shortcut-app-db \
  --skip-final-snapshot \
  --delete-automated-backups
```

### 9.3. ElastiCache を削除（作っていれば）

```bash
aws elasticache delete-cache-cluster --cache-cluster-id shortcut-app-redis
```

### 9.4. ECR リポジトリを削除（イメージごと）

```bash
aws ecr delete-repository --repository-name shortcut-backend --force
aws ecr delete-repository --repository-name shortcut-frontend --force
```

### 9.5. Secrets Manager のシークレットを削除

```bash
aws secretsmanager delete-secret --secret-id shortcut-app-django-secret --force-delete-without-recovery
aws secretsmanager delete-secret --secret-id shortcut-app-db-password --force-delete-without-recovery
```

### 9.6. CloudWatch ロググループを削除

App Runner / RDS が自動で作るロググループ:

```bash
aws logs describe-log-groups --query 'logGroups[?contains(logGroupName, `shortcut`)].logGroupName' --output text \
  | tr '\t' '\n' \
  | xargs -I {} aws logs delete-log-group --log-group-name {}
```

### 9.7. **最終確認**

```bash
# 残存リソースが無いか確認
aws apprunner list-services --query 'ServiceSummaryList[?contains(ServiceName, `shortcut`)]'
aws rds describe-db-instances --query 'DBInstances[?contains(DBInstanceIdentifier, `shortcut`)]'
aws elasticache describe-cache-clusters --query 'CacheClusters[?contains(CacheClusterId, `shortcut`)]'
aws ecr describe-repositories --query 'repositories[?contains(repositoryName, `shortcut`)]'
aws secretsmanager list-secrets --query 'SecretList[?contains(Name, `shortcut`)]'
```

全て空配列 `[]` になれば OK。

### 9.8. 翌日以降に Cost Explorer で $0 確認

AWS マネジメントコンソール → Cost Explorer → 当日分が反映されるまで 24 時間待つ。
それ以降に新規課金が乗っていないこと、累計が予想内（$1〜5）に収まっていることを確認。

---

## 10. 課金トラップチェックリスト

削除後にも残りやすいもの:

- [ ] **Elastic IP**: `aws ec2 describe-addresses` で `Anywhere` が無いか
- [ ] **EBS Snapshot**: `aws ec2 describe-snapshots --owner-ids self`
- [ ] **NAT Gateway**: `aws ec2 describe-nat-gateways --filter Name=state,Values=available`（本手順では作らないが念のため）
- [ ] **未削除の Hosted Zone**: `aws route53 list-hosted-zones`
- [ ] **CloudWatch Logs の retention**: 削除しなくても 1 年で消えるが、ストレージ課金が乗る

これら全て空であれば追加課金なし。

---

## 11. トラブルシューティング

| 症状 | 対処 |
|---|---|
| App Runner が `unhealthy` で起動失敗 | CloudWatch Logs で `gunicorn` のエラーを確認。多くは env 変数（DB 接続情報・ALLOWED_HOSTS）の不備 |
| `DisallowedHost` エラー | `DJANGO_ALLOWED_HOSTS` に `.awsapprunner.com` が入っているか |
| CSRF 失敗（403） | `CSRF_TRUSTED_ORIGINS` に Frontend の `https://` URL が入っているか |
| migrate が失敗 | RDS のセキュリティグループが App Runner 接続を許可しているか確認（学習用は `0.0.0.0/0` で 5432 開放） |
| Frontend → Backend 通信が CORS エラー | rewrites で同一オリジン化されるはず。`BACKEND_INTERNAL_URL` が build arg と runtime env 両方に入っているか確認 |

---

## 参考料金（東京、2025 時点）

数時間 〜 半日の学習用途:

| サービス | 概算 |
|---|---|
| App Runner × 2（0.25 vCPU/0.5GB） | $0.20-0.50 |
| RDS db.t4g.micro 4 時間 + 20GB ストレージ | $0.15 |
| ECR 1GB 数日 | $0.01 |
| Secrets Manager 2 シークレット 月割 | $0.05 |
| CloudWatch Logs 数十 MB | $0.05 |
| **合計** | **約 $0.50 - $1.00** |

ElastiCache、Route 53、ACM、データ転送（GB 単位なら無料枠内）は本手順では不要。
