# Use Bun runtime
FROM oven/bun:1.1.29 as base
WORKDIR /app

# Copy backend-specific package.json
COPY backend-package.json package.json

# Install dependencies (will create new lockfile)
RUN bun install

# Copy backend source code and configuration
COPY server ./server
COPY drizzle ./drizzle
COPY drizzle.config.ts ./

# Generate database migrations if needed
RUN bun run db:generate

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

# Start the application
CMD ["bun", "run", "start"]