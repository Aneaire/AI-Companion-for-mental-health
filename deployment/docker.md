# Docker Deployment Guide

This guide covers containerizing and deploying your Mental Health AI Chat application using Docker for both development and production environments.

## Prerequisites

- Docker and Docker Compose installed
- PostgreSQL database (local or cloud)
- Environment variables configured

## Project Structure

```
├── Dockerfile              # Backend container
├── frontend/
│   └── Dockerfile          # Frontend container  
├── docker-compose.yml      # Development setup
├── docker-compose.prod.yml # Production setup
├── .dockerignore          # Docker ignore file
└── nginx/
    └── nginx.conf         # Nginx configuration
```

## Step 1: Create Dockerfiles

### Backend Dockerfile

Create `Dockerfile` in the root directory:

```dockerfile
# Use Bun runtime
FROM oven/bun:1.1.29 as base
WORKDIR /app

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client (if using Prisma)
# RUN bun run db:generate

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
CMD ["bun", "run", "start"]
```

### Frontend Dockerfile

Create `frontend/Dockerfile`:

```dockerfile
# Build stage
FROM oven/bun:1.1.29 as build
WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

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
```

## Step 2: Nginx Configuration

Create `frontend/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;

        # Handle client-side routing
        location / {
            try_files $uri $uri/ /index.html;
        }

        # API proxy to backend
        location /api/ {
            proxy_pass http://backend:3000/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;
    }
}
```

## Step 3: Docker Compose Setup

### Development Configuration

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: mental_health_db
    environment:
      POSTGRES_DB: mental_health
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Backend Service
  backend:
    build: .
    container_name: mental_health_backend
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/mental_health
      - CLERK_SECRET_KEY=${CLERK_SECRET_KEY}
      - GOOGLE_AI_API_KEY=${GOOGLE_AI_API_KEY}
      - PORT=3000
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - .:/app
      - node_modules:/app/node_modules
    restart: unless-stopped

  # Frontend Service
  frontend:
    build: ./frontend
    container_name: mental_health_frontend
    environment:
      - VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}
      - VITE_API_BASE_URL=http://localhost:3000/api
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
  node_modules:
```

### Production Configuration

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  # Backend Service
  backend:
    build:
      context: .
      target: base
    container_name: mental_health_backend_prod
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - CLERK_SECRET_KEY=${CLERK_SECRET_KEY}
      - GOOGLE_AI_API_KEY=${GOOGLE_AI_API_KEY}
      - PORT=3000
    ports:
      - "3000:3000"
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Frontend Service
  frontend:
    build:
      context: ./frontend
    container_name: mental_health_frontend_prod
    environment:
      - VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}
      - VITE_API_BASE_URL=https://yourdomain.com/api
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
    restart: always
    volumes:
      - ./ssl:/etc/ssl/certs  # For SSL certificates

  # Redis for caching (optional)
  redis:
    image: redis:alpine
    container_name: mental_health_redis
    ports:
      - "6379:6379"
    restart: always
```

## Step 4: Environment Configuration

Create `.env` file:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/mental_health

# Authentication
CLERK_SECRET_KEY=your_clerk_secret_key
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

# AI Service
GOOGLE_AI_API_KEY=your_google_ai_api_key

# Application
NODE_ENV=development
PORT=3000
VITE_API_BASE_URL=http://localhost:3000/api
```

Create `.dockerignore`:

```dockerignore
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.env.local
.nyc_output
coverage
.nyc_output
.coverage
.vscode
.idea
*.log
dist
build
```

## Step 5: Deployment Commands

### Development Deployment

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild and restart
docker-compose up -d --build

# Run database migrations
docker-compose exec backend bun run db:migrate
```

### Production Deployment

```bash
# Build and start production services
docker-compose -f docker-compose.prod.yml up -d --build

# View production logs
docker-compose -f docker-compose.prod.yml logs -f

# Scale services
docker-compose -f docker-compose.prod.yml up -d --scale backend=3

# Stop production services
docker-compose -f docker-compose.prod.yml down
```

## Step 6: Cloud Deployment Options

### AWS ECS Deployment

Create `task-definition.json`:

```json
{
  "family": "mental-health-app",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "your-account.dkr.ecr.region.amazonaws.com/mental-health-backend:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:ssm:region:account:parameter/database-url"
        }
      ]
    }
  ]
}
```

### Digital Ocean App Platform

Create `.do/app.yaml`:

```yaml
name: mental-health-app
services:
- name: backend
  source_dir: /
  github:
    repo: your-username/mental-health-app
    branch: main
  run_command: bun run start
  environment_slug: docker
  instance_count: 1
  instance_size_slug: basic-xxs
  dockerfile_path: Dockerfile

- name: frontend  
  source_dir: /frontend
  github:
    repo: your-username/mental-health-app
    branch: main
  environment_slug: docker
  instance_count: 1
  instance_size_slug: basic-xxs
  dockerfile_path: Dockerfile
```

### Google Cloud Run

```bash
# Build and push to Google Container Registry
docker build -t gcr.io/your-project/mental-health-backend .
docker push gcr.io/your-project/mental-health-backend

# Deploy to Cloud Run
gcloud run deploy mental-health-backend \
  --image gcr.io/your-project/mental-health-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## Step 7: Health Checks and Monitoring

Add health check endpoint to your backend:

```typescript
// server/index.ts
app.get('/api/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version
  })
})
```

### Docker Health Checks

```dockerfile
# In your Dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
```

### Monitoring with Docker Stats

```bash
# Monitor container resources
docker stats

# View container logs
docker logs -f mental_health_backend

# Execute commands in container
docker exec -it mental_health_backend bun run db:migrate
```

## Step 8: Production Optimizations

### Multi-stage Build Optimization

```dockerfile
# Optimized backend Dockerfile
FROM oven/bun:1.1.29-slim as deps
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.1.29-slim as build
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1.1.29-slim as runtime
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

EXPOSE 3000
USER bun
CMD ["bun", "run", "start"]
```

### SSL/TLS Configuration

```nginx
# SSL-enabled nginx.conf
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/ssl/certs/cert.pem;
    ssl_certificate_key /etc/ssl/private/key.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=63072000" always;
    
    # Rest of configuration...
}
```

## Troubleshooting

### Common Issues

1. **Container won't start**
   ```bash
   # Check container logs
   docker logs mental_health_backend
   
   # Check container status
   docker ps -a
   ```

2. **Database connection issues**
   ```bash
   # Test database connectivity
   docker exec mental_health_backend ping postgres
   
   # Check database logs
   docker logs mental_health_db
   ```

3. **Environment variables not loading**
   ```bash
   # Check environment variables in container
   docker exec mental_health_backend env
   ```

### Performance Monitoring

```bash
# Monitor Docker resource usage
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

# Check container health
docker inspect mental_health_backend | grep Health -A 10
```

This Docker setup provides a complete containerized deployment solution with development and production configurations, health checks, and monitoring capabilities.