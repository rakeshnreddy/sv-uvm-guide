# Dockerfile for Next.js App (Standalone Output)

# Stage 1: Builder
FROM node:20-alpine AS builder
# Set working directory
WORKDIR /app

# Install dependencies
# Copy package.json and package-lock.json (or yarn.lock)
COPY package.json package-lock.json* ./
# If you have a private npm registry or need other configs:
# COPY .npmrc .npmrc
RUN npm install --frozen-lockfile

# Copy application code
COPY . .

# Build the Next.js application
RUN npm run build

# Stage 2: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# Optionally, set a different port, Next.js default is 3000
# ENV PORT=8080

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
# Copy the standalone build output
COPY --from=builder /app/.next/standalone ./
# Copy the static assets from .next/static (needed for standalone)
COPY --from=builder /app/.next/static ./.next/static
# Copy public assets
COPY --from=builder /app/public ./public

# The standalone output includes a server.js file to start the app
# CMD ["node", "server.js"]
# Alternatively, if your start script handles this (e.g. "next start -p $PORT")
# You might need to copy package.json again if `next start` is used and it relies on it
# For standalone, server.js is preferred if available.
# Check your .next/standalone directory after build to see if server.js is there.
# If server.js exists in .next/standalone, this is the typical command:
EXPOSE 3000
CMD ["node", "server.js"]

# If you don't have a server.js in the standalone output, or prefer `next start`:
# You'll need to copy package.json and potentially next.config.js if `next start` requires them.
# COPY --from=builder /app/package.json ./package.json
# COPY --from=builder /app/next.config.js ./next.config.js # If it contains runtime config
# EXPOSE 3000
# CMD ["npm", "start"]
