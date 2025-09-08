FROM node:18

WORKDIR /app

# Node.js 依存関係をインストール
COPY app/package*.json ./
RUN npm install


# アプリコードをコピー
COPY app/. .

CMD ["npm", "run", "dev"]