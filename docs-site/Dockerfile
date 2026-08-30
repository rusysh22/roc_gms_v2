# Build the static Starlight site, serve it with a tiny nginx. The public reverse proxy
# (~/berlanggan/nginx) terminates TLS and proxies docs.intourney.id to this container.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Starlight emits clean-URL directories with index.html; this makes /getting-started resolve, and
# 404s fall back to Starlight's own 404 page.
RUN printf 'server {\n\
  listen 80;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  location / { try_files $uri $uri/ $uri.html /404.html; }\n\
}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
