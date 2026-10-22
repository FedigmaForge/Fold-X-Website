# ─── Build the React app ─────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# Empty = call the API on the same domain (nginx below proxies /api).
ARG VITE_API_URL=""
ARG VITE_RAZORPAY_KEY_ID=""
ENV VITE_API_URL=$VITE_API_URL \
    VITE_RAZORPAY_KEY_ID=$VITE_RAZORPAY_KEY_ID
RUN npm run build

# ─── Serve it with nginx ─────────────────────────────────
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
