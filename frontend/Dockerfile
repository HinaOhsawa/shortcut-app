FROM node:18

WORKDIR /app

COPY app/package*.json ./
RUN npm install

COPY app/. .

CMD ["npm", "run", "dev"]
