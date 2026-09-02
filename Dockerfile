FROM node:22-alpine

# Base fonts + fontconfig for any server-side SVG text rasterisation via sharp/libvips. The social
# share cards (src/lib/ogCard.ts) don't rely on this - they outline text with a bundled font - but
# Alpine ships with no fonts at all, so this is here for anything else that needs them.
RUN apk add --no-cache font-dejavu fontconfig && fc-cache -f

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
