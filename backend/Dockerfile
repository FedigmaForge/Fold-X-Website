FROM node:22-slim

# Prisma's query engine needs OpenSSL
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate

ENV NODE_ENV=production
EXPOSE 4000

# Apply any new migrations (safe: deploy only adds, never resets), then start.
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
