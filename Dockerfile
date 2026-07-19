FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY packages ./packages
RUN npm install
COPY . .
RUN npm run build
FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production
CMD ["npm", "run", "start"]
