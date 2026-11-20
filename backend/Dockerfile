FROM node:20-alpine

WORKDIR /app

# su-exec lets the entrypoint drop from root to "node" after fixing the
# ownership of a mounted uploads disk.
RUN apk add --no-cache su-exec fontconfig ttf-dejavu

# Install dependencies first so Docker caches this layer between code changes.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Uploads volume gets mounted here at runtime.
RUN mkdir -p uploads && chown -R node:node uploads && chmod +x docker-entrypoint.sh

EXPOSE 5000

# Starts as root only long enough for the entrypoint to chown the uploads
# mount; the server process itself runs as the unprivileged "node" user.
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
