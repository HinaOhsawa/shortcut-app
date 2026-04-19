# shortcut-app

ショートカットキーを管理・共有できるWebアプリケーション

Monorepo for frontend (Next.js) and backend (Django)

## 🚀 クイックスタート

### 前提条件
- Docker & Docker Compose がインストールされていること

### 起動方法

1. **プロジェクトディレクトリに移動**
```bash
cd shortcut-app
```

2. **Docker Compose で全サービス起動**
```bash
docker-compose up
```

3. **初回のマイグレーション実行**
```bash
docker-compose exec backend python manage.py migrate
```

### アクセス
| サービス | URL |
|---------|-----|
| **Frontend** | http://localhost:3000 |
| **Backend API** | http://localhost:8000 |
| **Django Admin** | http://localhost:8000/admin/ |

### DB接続情報
- **Host**: localhost:5432
- **User**: myuser
- **Password**: mypassword
- **Database**: shortcuts

---

## 📦 ローカル開発（Docker不使用）

### バックエンド
```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### フロントエンド
```bash
cd frontend/app
npm install
npm run dev
```

---

## 📋 使用技術

### Backend
- Django 4.2 + Django REST Framework
- PostgreSQL 15
- JWT認証 (djangorestframework-simplejwt)
- CORS対応 (django-cors-headers)

### Frontend
- Next.js 15.5
- React 19
- TypeScript 5
- Tailwind CSS 4
- React Hook Form + Zod

---

## 📂 プロジェクト構成

### Frontend
Next.js project in `frontend/app/`

### Backend
Django project in `backend/`

### Docker
`docker-compose.yml` で両方のサービスを起動可能
