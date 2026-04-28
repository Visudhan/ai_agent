FROM node:18-alpine
WORKDIR /app
COPY server/ ./
RUN npm install
EXPOSE 3000
CMD ["node", "src/index.js"]