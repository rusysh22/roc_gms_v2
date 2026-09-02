FROM node:22-alpine

# Fonts + fontconfig so server-side SVG rasterisation (sharp/libvips) can draw text - used by the
# generated social share cards (src/lib/ogCard.ts). Alpine ships with no fonts at all otherwise.
RUN apk add --no-cache font-dejavu fontconfig && fc-cache -f

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
