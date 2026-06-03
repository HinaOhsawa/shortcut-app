# AWS ECS Fargate デプロイ手順（学習用、実施記録）

学習目的で本アプリを AWS ECS Fargate にデプロイし、検証後すぐ削除した手順の記録。
ドメイン無し、HTTP のみの最小構成。

## 0. 背景

- 当初は AWS App Runner を予定していたが、**2026-04-30 以降は新規受付停止**となったため ECS Fargate に切り替え
- 元の App Runner 用手順は [aws-deploy.md](aws-deploy.md) として残置（参考用）
- HTTPS（ACM 証明書 + 独自ドメイン）は別途必要なため、本手順は **HTTP のみ**
- 完了後すぐ削除する想定。**Budgets で $5 アラートを最初に設定**

## 1. 構成図

```
                          [Internet]
                              │ HTTP 80
                              ▼
                ┌─────────────────────────────┐
                │  Application Load Balancer  │
                │  /api/* → backend TG        │
                │  /*     → frontend TG       │
                └──────┬──────────────┬───────┘
                       │              │
                  ┌────▼────┐    ┌────▼────┐
                  │ Backend │    │Frontend │
                  │ Target  │    │ Target  │
                  │ Group   │    │ Group   │
                  └────┬────┘    └────┬────┘
                       │              │
                  ┌────▼────┐    ┌────▼────┐
                  │ ECS Svc │    │ ECS Svc │
                  │ Fargate │    │ Fargate │
                  │ Django  │    │ Next.js │
                  │ :8080   │    │ :3000   │
                  └────┬────┘    └─────────┘
                       │
                       ▼
                  ┌─────────┐
                  │  RDS    │
                  │Postgres │
                  └─────────┘
```

**ALB が path routing で「Frontend と Backend を 1 つのオリジン」に見せる** ことで、HttpOnly Cookie + CSRF の同一オリジン要件を満たす。

---

## 2. 事前準備

### 2.1 AWS Budgets でアラート設定（**最初に必ずやる**）

マネコン → Billing → Budgets で $5 のコストバジェットを作成。
50% / 80% / 100% でメール通知。

### 2.2 AWS CLI v2 セットアップ

```bash
brew install awscli
aws --version  # aws-cli/2.x.x を確認

# IAM ユーザー作成（AdministratorGroup に追加）→ アクセスキー発行 → 設定
aws configure
# Access Key ID / Secret / region=ap-northeast-1 / output=json

# 認証確認
aws sts get-caller-identity
```

### 2.3 環境変数を `.zshrc` に保存

```bash
cat >> ~/.zshrc <<'EOF'

# === AWS for shortcut-app ===
export AWS_ACCOUNT_ID=<your account id>
export AWS_REGION=ap-northeast-1
export AWS_DEFAULT_REGION=ap-northeast-1
EOF
source ~/.zshrc
```

### 2.4 デフォルト VPC とサブネットの確認/作成

過去に削除されているとデフォルト VPC が無いことがある。

```bash
# 状態確認
aws ec2 describe-vpcs --filters "Name=is-default,Values=true" \
  --query 'Vpcs[].{VpcId:VpcId,IsDefault:IsDefault}'

# 無ければ作成（VPC + サブネット + IGW を一括）
aws ec2 create-default-vpc

# サブネットだけ無い場合は AZ ごとに
aws ec2 create-default-subnet --availability-zone ap-northeast-1a
aws ec2 create-default-subnet --availability-zone ap-northeast-1c
aws ec2 create-default-subnet --availability-zone ap-northeast-1d
```

---

## 3. ECR にイメージ push

### 3.1 リポジトリ作成

```bash
aws ecr create-repository --repository-name shortcut-backend
aws ecr create-repository --repository-name shortcut-frontend
```

### 3.2 Docker を ECR に認証（12 時間有効）

```bash
aws ecr get-login-password \
  | docker login --username AWS --password-stdin \
      $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
```

### 3.3 Backend イメージ

```bash
cd /Users/osawahina/Project/shortcut-app/backend  # ← cd 必須

docker build --platform linux/amd64 -f Dockerfile.prod \
  -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/shortcut-backend:latest .

docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/shortcut-backend:latest
```

> ⚠️ **ハマりポイント**: `cd backend` を忘れて `frontend` ディレクトリのまま実行すると、Next.js のイメージが backend タグで push されて ECS タスクが起動失敗する。`pwd` で必ず確認。

### 3.4 Frontend イメージ（Backend デプロイ後に実施）

ALB で path routing するため Next.js の rewrites は実は使われないが、念のため build arg を渡しておく。

```bash
cd /Users/osawahina/Project/shortcut-app/frontend

docker build --platform linux/amd64 -f Dockerfile.prod \
  --build-arg BACKEND_INTERNAL_URL=http://placeholder \
  -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/shortcut-frontend:latest .

docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/shortcut-frontend:latest
```

---

## 4. セキュリティグループ作成

```
[Internet] → ALB-SG (80) → ECS-SG (8080/3000) → RDS-SG (5432)
```

マネコンの EC2 → Security Groups から作成、または CLI で。

| SG 名 | Inbound |
|---|---|
| `shortcut-app-alb-sg` | HTTP 80 from `0.0.0.0/0` |
| `shortcut-app-ecs-sg` | TCP 8080 / 3000 from `shortcut-app-alb-sg`（Source に SG ID 指定） |

ARN を控える:

```bash
ALB_SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=shortcut-app-alb-sg" \
  --query 'SecurityGroups[0].GroupId' --output text)
ECS_SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=shortcut-app-ecs-sg" \
  --query 'SecurityGroups[0].GroupId' --output text)

echo "export ALB_SG_ID=$ALB_SG_ID" >> ~/.zshrc
echo "export ECS_SG_ID=$ECS_SG_ID" >> ~/.zshrc
source ~/.zshrc
```

---

## 5. RDS PostgreSQL

### 5.1 作成（マネコンのフル設定）

主要設定:
- Engine: PostgreSQL 16.x
- Template: Dev/Test（または Free tier）
- DB instance identifier: `shortcut-app-db`
- Master username: `postgres`
- Master password: 強い値（後述）
- Instance class: `db.t4g.micro`
- Storage: 20 GiB GP3、autoscaling OFF
- Multi-AZ: No
- VPC: Default、**Public access: Yes**
- Security group: 新規 `shortcut-app-db-sg`
- Initial database name: **`shortcuts`** ⚠️必須
- Backup retention: **0 days**
- Deletion protection: **OFF**

### 5.2 パスワード生成

```bash
RDS_MASTER_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-20)
echo "export RDS_MASTER_PASSWORD=\"$RDS_MASTER_PASSWORD\"" >> ~/.zshrc
source ~/.zshrc
```

### 5.3 エンドポイントを控える

```bash
RDS_ENDPOINT=$(aws rds describe-db-instances --db-instance-identifier shortcut-app-db \
  --query 'DBInstances[0].Endpoint.Address' --output text)
echo "export RDS_ENDPOINT=$RDS_ENDPOINT" >> ~/.zshrc
source ~/.zshrc
```

### 5.4 セキュリティグループに 5432 を開放

学習用に簡素化（`0.0.0.0/0` で全公開）。本番は ECS SG に限定する。

```bash
RDS_SG_ID=$(aws rds describe-db-instances --db-instance-identifier shortcut-app-db \
  --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $RDS_SG_ID \
  --protocol tcp --port 5432 --cidr 0.0.0.0/0
```

### 5.5 接続テスト

```bash
brew install libpq && brew link --force libpq

psql "host=$RDS_ENDPOINT port=5432 user=postgres password=$RDS_MASTER_PASSWORD dbname=shortcuts sslmode=require" \
  -c '\l'
```

`shortcuts` データベースが見えれば OK。

---

## 6. CloudWatch + IAM 準備

### 6.1 ロググループ

```bash
aws logs create-log-group --log-group-name /ecs/shortcut-app-backend
aws logs put-retention-policy --log-group-name /ecs/shortcut-app-backend --retention-in-days 1

aws logs create-log-group --log-group-name /ecs/shortcut-app-frontend
aws logs put-retention-policy --log-group-name /ecs/shortcut-app-frontend --retention-in-days 1
```

### 6.2 ECS Task Execution Role

```bash
# 既存確認
aws iam get-role --role-name ecsTaskExecutionRole 2>&1 | head -3

# 無ければ作成
cat > /tmp/trust-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "ecs-tasks.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
EOF

aws iam create-role --role-name ecsTaskExecutionRole \
  --assume-role-policy-document file:///tmp/trust-policy.json

aws iam attach-role-policy --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

rm /tmp/trust-policy.json

# ARN を控える
TASK_EXEC_ROLE_ARN=$(aws iam get-role --role-name ecsTaskExecutionRole --query 'Role.Arn' --output text)
echo "export TASK_EXEC_ROLE_ARN=$TASK_EXEC_ROLE_ARN" >> ~/.zshrc
source ~/.zshrc
```

### 6.3 AWSServiceRoleForECS の存在確認

ECS クラスター作成に必要。無いと作成失敗する。

```bash
aws iam get-role --role-name AWSServiceRoleForECS 2>&1 | head -3

# 無ければ作成（マネコンからクラスター作成で失敗するため事前作成）
aws iam create-service-linked-role --aws-service-name ecs.amazonaws.com
sleep 20  # IAM 伝播待ち
```

---

## 7. ECS Cluster

マネコンで作成エラーが出たら CLI で:

```bash
aws ecs create-cluster --cluster-name shortcut-app-cluster
```

---

## 8. Backend デプロイ

### 8.1 Backend Target Group

マネコン EC2 → Target Groups → Create:
- Target type: **IP addresses**
- Name: `shortcut-app-backend-tg`
- Protocol/Port: HTTP / 8080
- VPC: Default
- Health check path: **`/healthz`**
- Success codes: 200

```bash
BACKEND_TG_ARN=$(aws elbv2 describe-target-groups --names shortcut-app-backend-tg \
  --query 'TargetGroups[0].TargetGroupArn' --output text)
echo "export BACKEND_TG_ARN=$BACKEND_TG_ARN" >> ~/.zshrc
source ~/.zshrc
```

### 8.2 ALB 作成

マネコン EC2 → Load Balancers → Create → Application Load Balancer:
- Name: `shortcut-app-alb`
- Scheme: Internet-facing
- VPC: Default、AZ は全て選択
- Security groups: `shortcut-app-alb-sg`
- Listener: HTTP 80 → `shortcut-app-backend-tg`（初期値）

```bash
ALB_DNS=$(aws elbv2 describe-load-balancers --names shortcut-app-alb \
  --query 'LoadBalancers[0].DNSName' --output text)
echo "export ALB_DNS=$ALB_DNS" >> ~/.zshrc
source ~/.zshrc
```

### 8.3 DJANGO_SECRET_KEY 生成

```bash
DJANGO_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
echo "export DJANGO_SECRET=\"$DJANGO_SECRET\"" >> ~/.zshrc
source ~/.zshrc
```

### 8.4 Backend Task Definition

```bash
cat > /tmp/backend-task.json <<EOF
{
  "family": "shortcut-app-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "$TASK_EXEC_ROLE_ARN",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/shortcut-backend:latest",
      "essential": true,
      "portMappings": [{ "containerPort": 8080, "protocol": "tcp" }],
      "environment": [
        { "name": "DJANGO_SECRET_KEY", "value": "$DJANGO_SECRET" },
        { "name": "DJANGO_DEBUG", "value": "False" },
        { "name": "DJANGO_FORCE_HTTPS", "value": "False" },
        { "name": "DJANGO_ALLOWED_HOSTS", "value": "*" },
        { "name": "POSTGRES_DB", "value": "shortcuts" },
        { "name": "POSTGRES_USER", "value": "postgres" },
        { "name": "POSTGRES_PASSWORD", "value": "$RDS_MASTER_PASSWORD" },
        { "name": "POSTGRES_HOST", "value": "$RDS_ENDPOINT" },
        { "name": "POSTGRES_PORT", "value": "5432" },
        { "name": "CSRF_TRUSTED_ORIGINS", "value": "http://$ALB_DNS" },
        { "name": "CORS_ALLOWED_ORIGINS", "value": "http://$ALB_DNS" },
        { "name": "EMAIL_BACKEND", "value": "django.core.mail.backends.console.EmailBackend" },
        { "name": "DEFAULT_FROM_EMAIL", "value": "noreply@example.com" },
        { "name": "FRONTEND_ORIGIN", "value": "http://$ALB_DNS" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/shortcut-app-backend",
          "awslogs-region": "$AWS_REGION",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
EOF

aws ecs register-task-definition --cli-input-json file:///tmp/backend-task.json --no-cli-pager \
  --query 'taskDefinition.{Family:family,Revision:revision}'
rm /tmp/backend-task.json
```

> ポイント: `DJANGO_ALLOWED_HOSTS=*` は学習用妥協。ALB ヘルスチェッカーが Host ヘッダにタスク IP を入れて送ってくるため、`.elb.amazonaws.com` だけでは 400 になる。本番は別経路でヘルスチェックを通すか SECURE_REDIRECT_EXEMPT で限定的に許可する設計が望ましい。

### 8.5 Backend Service

```bash
SUBNET_IDS=$(aws ec2 describe-subnets \
  --filters "Name=default-for-az,Values=true" \
  --query 'Subnets[].SubnetId' --output text | tr '\t' ',')

aws ecs create-service \
  --cluster shortcut-app-cluster \
  --service-name shortcut-app-backend \
  --task-definition shortcut-app-backend \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$ECS_SG_ID],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=$BACKEND_TG_ARN,containerName=backend,containerPort=8080" \
  --health-check-grace-period-seconds 60 --no-cli-pager
```

### 8.6 動作確認

3〜5 分待ってから:

```bash
# Service 状態
aws ecs describe-services --cluster shortcut-app-cluster --services shortcut-app-backend \
  --query 'services[0].{Running:runningCount,Desired:desiredCount}'

# Target 状態
aws elbv2 describe-target-health --target-group-arn $BACKEND_TG_ARN \
  --query 'TargetHealthDescriptions[].State'

# /healthz
curl http://$ALB_DNS/healthz   # → {"status": "ok"}

# 登録 → ログイン → profile の一気通貫
rm -f /tmp/cookies.txt
curl -X POST http://$ALB_DNS/api/accounts/register/ \
  -H "Content-Type: application/json" \
  -d '{"name":"E2E","email":"e2e@example.com","password":"Strongpass123!"}'

curl -c /tmp/cookies.txt -X POST http://$ALB_DNS/api/accounts/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"e2e@example.com","password":"Strongpass123!"}'

curl -b /tmp/cookies.txt http://$ALB_DNS/api/accounts/profile/   # → 200
```

---

## 9. Frontend デプロイ

### 9.1 Frontend Target Group

マネコンで作成:
- Target type: **IP addresses**
- Name: `shortcut-app-frontend-tg`
- Protocol/Port: HTTP / 3000
- Health check path: **`/`**
- Success codes: 200

```bash
FRONTEND_TG_ARN=$(aws elbv2 describe-target-groups --names shortcut-app-frontend-tg \
  --query 'TargetGroups[0].TargetGroupArn' --output text)
echo "export FRONTEND_TG_ARN=$FRONTEND_TG_ARN" >> ~/.zshrc
source ~/.zshrc
```

### 9.2 ALB Listener を path routing に変更

マネコン EC2 → Load Balancers → `shortcut-app-alb` → Listeners and rules → HTTP:80 → Manage rules:

| Priority | Conditions | Action |
|---|---|---|
| 10 | Path: `/api/*` | Forward → `shortcut-app-backend-tg` |
| default | - | Forward → `shortcut-app-frontend-tg` |

### 9.3 Frontend Task Definition

```bash
cat > /tmp/frontend-task.json <<EOF
{
  "family": "shortcut-app-frontend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "$TASK_EXEC_ROLE_ARN",
  "containerDefinitions": [
    {
      "name": "frontend",
      "image": "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/shortcut-frontend:latest",
      "essential": true,
      "portMappings": [{ "containerPort": 3000, "protocol": "tcp" }],
      "environment": [{ "name": "NODE_ENV", "value": "production" }],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/shortcut-app-frontend",
          "awslogs-region": "$AWS_REGION",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
EOF

aws ecs register-task-definition --cli-input-json file:///tmp/frontend-task.json --no-cli-pager \
  --query 'taskDefinition.{Family:family,Revision:revision}'
rm /tmp/frontend-task.json
```

### 9.4 Frontend Service

```bash
aws ecs create-service \
  --cluster shortcut-app-cluster \
  --service-name shortcut-app-frontend \
  --task-definition shortcut-app-frontend \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$ECS_SG_ID],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=$FRONTEND_TG_ARN,containerName=frontend,containerPort=3000" \
  --health-check-grace-period-seconds 60 --no-cli-pager
```

### 9.5 ブラウザで確認

```bash
echo "Open: http://$ALB_DNS"
```

サインアップ → ダッシュボード → ショートカット作成 → サインアウト → 再ログイン が通れば完了。

---

## 10. ハマったポイントと対策

### 10.1 App Runner 新規受付停止
2026-04-30 以降、App Runner は新規利用不可。**ECS Fargate 等への切り替えが必要**。

### 10.2 HTTPS 強制で無限リダイレクト
`DEBUG=False` で SECURE_SSL_REDIRECT=True が効くが、ALB が HTTP 終端する構成だと無限ループになる。
→ PR #7 で `DJANGO_FORCE_HTTPS` env で切替可能化。

### 10.3 Secure Cookie が HTTP で送られない
`cookies.py` の Secure 属性が `not DEBUG` 固定で、HTTP-only ALB ではブラウザが Cookie を送らずログイン後の認証チェックが 401 になる。
→ PR #8 で `SESSION_COOKIE_SECURE` 設定と連動するよう修正。

### 10.4 ECR の :latest タグの取り違え
`cd backend` 忘れて `frontend` ディレクトリで Backend 用のビルドコマンドを実行 → Next.js イメージが `shortcut-backend:latest` として push され、ECS タスクが起動失敗（/healthz が無いため）。
→ ビルド前に必ず `pwd` で確認。

### 10.5 ELB-HealthChecker が DisallowedHost で 400
ヘルスチェッカーは Host ヘッダにタスク IP を入れて送る。`.elb.amazonaws.com` だけでは弾かれる。
→ `DJANGO_ALLOWED_HOSTS=*`（学習用妥協）または ALB 経路ヘルスチェック設計を見直す。

### 10.6 ECS クラスター作成時の service-linked role 失敗
マネコンから `Create cluster` で「Unable to assume the service linked role」になる。
→ `aws iam create-service-linked-role --aws-service-name ecs.amazonaws.com` で先に作成。

### 10.7 デフォルト VPC / サブネットが削除済み
過去に手動削除されていることがあり、RDS / ECS 作成時に失敗する。
→ `aws ec2 create-default-vpc` で再作成。

### 10.8 RDS マスターパスワード忘れ
`Modify` で再設定可能（即時反映）。

### 10.9 タスクの起動失敗時のデバッグ
```bash
# Service イベントで概要把握
aws ecs describe-services --cluster shortcut-app-cluster --services <service> \
  --query 'services[0].events[0:10]'

# 個別タスクのログ
aws logs tail /ecs/shortcut-app-<svc> --since 10m --no-cli-pager

# 停止タスクの理由
aws ecs describe-tasks --cluster shortcut-app-cluster --tasks <task-id> \
  --query 'tasks[0].{StoppedReason:stoppedReason,Containers:containers[].{ExitCode:exitCode,Reason:reason}}'
```

---

## 11. 削除手順（依存関係順）

### 11.1 ECS Service 削除（**最優先、課金停止**）

```bash
for SVC in shortcut-app-backend shortcut-app-frontend; do
  aws ecs delete-service --cluster shortcut-app-cluster --service $SVC --force --no-cli-pager
done
sleep 30
```

### 11.2 ECS Cluster

```bash
aws ecs delete-cluster --cluster shortcut-app-cluster --no-cli-pager
```

### 11.3 ALB と Target Groups

```bash
ALB_ARN=$(aws elbv2 describe-load-balancers --names shortcut-app-alb \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)
aws elbv2 delete-load-balancer --load-balancer-arn $ALB_ARN

sleep 30  # ALB 削除完了待ち

for TG in shortcut-app-backend-tg shortcut-app-frontend-tg; do
  TG_ARN=$(aws elbv2 describe-target-groups --names $TG \
    --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null)
  [ -n "$TG_ARN" ] && aws elbv2 delete-target-group --target-group-arn $TG_ARN
done
```

### 11.4 RDS（**`--skip-final-snapshot` 必須**）

```bash
aws rds delete-db-instance \
  --db-instance-identifier shortcut-app-db \
  --skip-final-snapshot \
  --delete-automated-backups --no-cli-pager
```

`--skip-final-snapshot` を忘れると snapshot が残り月 $0.05/GB 課金される。

### 11.5 ECR

```bash
for REPO in shortcut-backend shortcut-frontend; do
  aws ecr delete-repository --repository-name $REPO --force --no-cli-pager
done
```

### 11.6 CloudWatch Logs

```bash
for LG in /ecs/shortcut-app-backend /ecs/shortcut-app-frontend; do
  aws logs delete-log-group --log-group-name $LG
done
```

### 11.7 Security Groups（RDS 削除完了後）

```bash
# RDS 削除完了待ち
while aws rds describe-db-instances --db-instance-identifier shortcut-app-db 2>/dev/null \
  | grep -q DBInstanceStatus; do sleep 30; done

RDS_SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=rds-launch-wizard-*" \
  --query 'SecurityGroups[?contains(GroupName, `rds`)].GroupId' --output text 2>/dev/null)

for SG in $ECS_SG_ID $RDS_SG_ID $ALB_SG_ID; do
  [ -n "$SG" ] && aws ec2 delete-security-group --group-id $SG
done
```

### 11.8 IAM ロール

`ecsTaskExecutionRole` と `AWSServiceRoleForECS` は **削除推奨しない**（他プロジェクトで再利用可、課金ゼロ）。

### 11.9 最終確認

全リストが空になるはず:

```bash
echo "--- ECS ---";       aws ecs list-clusters --query 'clusterArns'
echo "--- RDS ---";       aws rds describe-db-instances --query 'DBInstances[?contains(DBInstanceIdentifier,`shortcut`)]'
echo "--- ELB ---";       aws elbv2 describe-load-balancers --query 'LoadBalancers[?contains(LoadBalancerName,`shortcut`)]'
echo "--- ECR ---";       aws ecr describe-repositories --query 'repositories[?contains(repositoryName,`shortcut`)]'
echo "--- SGs ---";       aws ec2 describe-security-groups \
                            --filters "Name=group-name,Values=shortcut-app-*" \
                            --query 'SecurityGroups[].GroupName'
echo "--- Logs ---";      aws logs describe-log-groups --log-group-name-prefix /ecs/shortcut
```

翌日 Billing → Cost Explorer で予想内の金額（数ドル）で止まっていることを確認。

---

## 12. 実際にかかったコスト（参考）

数日にわたって試行錯誤しながらの利用で **約 $5〜10** 程度。
1 日で集中して構築・確認・削除すれば **$1〜3** に抑えられる。

主な内訳:
- RDS db.t4g.micro: 時間 $0.026
- ECS Fargate × 2: 時間 ~$0.022（0.25 vCPU + 0.5GB の最小構成）
- ALB: 時間 $0.027
- 計: 1 時間あたり ~$0.10、4 時間で $0.50 程度

SES / Route 53 / ACM / CloudFront は本構成では未使用なので $0。

---

## 13. 今後の改善点（参考）

| 項目 | 今回の妥協 | 本番ならどうするか |
|---|---|---|
| HTTPS | HTTP-only | ACM 証明書 + 独自ドメインで HTTPS 化 |
| ALLOWED_HOSTS | `*` | 特定ドメインに絞る、ヘルスチェック経路は別設計 |
| RDS 公開 | `0.0.0.0/0` で 5432 | ECS SG だけからの 5432 に絞る、Public access OFF |
| Throttle | Redis 無し | ElastiCache Redis で worker 間共有 |
| デプロイ | 手動 build/push | GitHub Actions で main マージ → 自動 push & デプロイ |
| 監視 | なし | CloudWatch Alarms + メール通知 |
| Secrets | env var 直書き | Secrets Manager / Parameter Store 参照 |
| バックアップ | 無効 | RDS 自動バックアップ 7 日 + cross-region snapshot |
