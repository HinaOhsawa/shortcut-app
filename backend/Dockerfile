FROM python:3.11-slim

WORKDIR /app

# Python の依存関係をインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリコードをコピー
COPY . .

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]