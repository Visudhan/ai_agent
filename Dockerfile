FROM node:18-alpine
WORKDIR /app
COPY server/package*.json ./server/
COPY server/package-lock.json ./server/
WORKDIR /app/server
RUN npm install --production
COPY server/ ./
WORKDIR /app
EXPOSE 3000
CMD ["node", "src/index.js"]