# Build stage
FROM oven/bun:1.1.29 as build
WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./
RUN bun install

# Copy source and build
COPY . .
RUN bun run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]