FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
COPY packages ./packages
RUN npm install && npx playwright install --with-deps chromium && apt-get update && apt-get install -y --no-install-recommends novnc websockify x11vnc xvfb && rm -rf /var/lib/apt/lists/*
COPY . .
RUN npm run build
COPY docker/entrypoint.sh /usr/local/bin/lustrestudio-entrypoint
RUN chmod 755 /usr/local/bin/lustrestudio-entrypoint
ENV NODE_ENV=production
CMD ["lustrestudio-entrypoint"]
