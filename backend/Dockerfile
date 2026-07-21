FROM node:20-alpine

# Prisma's query/schema engines need OpenSSL to run. Alpine's slim base
# doesn't include it, which caused "Could not parse schema engine response"
# errors at startup.
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

# Run as the non-root "node" user (built into the base image) instead of
# root, so a compromised dependency can't write outside /app or bind low ports.
RUN chown -R node:node /app
USER node

EXPOSE 5000
CMD ["node", "src/server.js"]
