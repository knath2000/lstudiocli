FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
COPY packages ./packages
RUN npm install && npx playwright install --with-deps chromium
COPY . .
RUN npm run build
ENV NODE_ENV=production
CMD ["npm", "run", "start"]
