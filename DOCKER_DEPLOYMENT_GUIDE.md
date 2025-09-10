# 🐳 Docker Deployment Guide - Mental Health AI Chat Application

This comprehensive guide will help you deploy your Mental Health AI Chat Application using Docker containers for both development and production environments.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Environment Configuration](#environment-configuration)
- [Development Deployment](#development-deployment)
- [Production Deployment](#production-deployment)
- [Management Commands](#management-commands)
- [Monitoring & Health Checks](#monitoring--health-checks)
- [Troubleshooting](#troubleshooting)
- [Cloud Deployment Options](#cloud-deployment-options)

## 🚀 Prerequisites

Before starting, ensure you have the following installed:

- **Docker Desktop** (v20.10+) - [Download here](https://www.docker.com/products/docker-desktop)
- **Docker Compose** (included with Docker Desktop)
- **Git** (for cloning the repository)
- **Text Editor** (for configuration files)

### Verify Installation

```bash
# Check Docker version
docker --version

# Check Docker Compose version
docker-compose --version

# Verify Docker is running
docker info
```

## ⚡ Quick Start

### Option 1: Automated Deployment (Recommended)

1. **Clone and navigate to the project:**
   ```bash
   git clone <your-repo-url>
   cd capstone
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual API keys and settings
   ```

3. **Run the deployment script:**
   ```bash
   # For Windows
   deploy-docker.bat
   
   # For Linux/Mac
   chmod +x deploy-docker.sh
   ./deploy-docker.sh
   ```

4. **Access your application:**
   - Frontend: http://localhost
   - Backend API: http://localhost:4000
   - Health Check: http://localhost:4000/api/health

### Option 2: Manual Deployment

```bash
# Build images
docker build -t mental-health-backend .
docker build -t mental-health-frontend ./frontend

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
```

## 📁 Project Structure

```
capstone/
├── Dockerfile                    # Backend container configuration
├── docker-compose.yml            # Development environment setup
├── .dockerignore                 # Docker build exclusions
├── .env.example                  # Environment variables template
├── deploy-docker.sh              # Linux/Mac deployment script
├── deploy-docker.bat             # Windows deployment script
├── frontend/
│   ├── Dockerfile                # Frontend container configuration
│   └── nginx.conf                # Nginx web server configuration
└── server/                       # Backend application code
```

## 🔧 Environment Configuration

### Required Environment Variables

Create a `.env` file from the template:

```bash
cp .env.example .env
```

Edit the `.env` file with your actual values:

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/mental_health

# AI API Keys
GOOGLE_AI_API_KEY=your_actual_google_ai_api_key

# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# Application Environment
NODE_ENV=development
PORT=4000

# Frontend API Base URL
VITE_API_BASE_URL=http://localhost:4000/api
```

### API Keys Setup

1. **Google AI API Key:**
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Add it to your `.env` file

2. **Clerk Authentication:**
   - Sign up at [Clerk.com](https://clerk.com)
   - Create a new application
   - Get your publishable and secret keys from the dashboard

## 🛠️ Development Deployment

### Standard Development Setup

```bash
# Start all services (database, backend, frontend)
docker-compose up -d

# View real-time logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Development with Hot Reload

For active development, you might want to run the frontend locally while using Docker for backend and database:

```bash
# Start only backend and database
docker-compose up -d postgres backend

# Run frontend locally (in a new terminal)
cd frontend
bun install
bun run dev
```

### Database Operations

```bash
# Run database migrations
docker-compose exec backend bun run db:migrate

# Access database directly
docker-compose exec postgres psql -U postgres -d mental_health

# View database logs
docker-compose logs postgres
```

## 🚀 Production Deployment

### Production Environment Variables

For production, update your `.env` file:

```env
NODE_ENV=production
DATABASE_URL=your_production_database_url
VITE_API_BASE_URL=https://yourdomain.com/api
```

### Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
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
      - PORT=4000
    ports:
      - "4000:4000"
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

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
```

### Deploy to Production

```bash
# Build and start production services
docker-compose -f docker-compose.prod.yml up -d --build

# View production logs
docker-compose -f docker-compose.prod.yml logs -f

# Scale backend service
docker-compose -f docker-compose.prod.yml up -d --scale backend=3
```

## 📊 Management Commands

### Container Management

```bash
# View running containers
docker ps

# View all containers (including stopped)
docker ps -a

# Stop specific service
docker-compose stop backend

# Restart specific service
docker-compose restart frontend

# Remove all containers and volumes
docker-compose down -v
```

### Image Management

```bash
# View Docker images
docker images

# Remove unused images
docker image prune

# Remove specific image
docker rmi mental-health-backend

# Rebuild specific service
docker-compose build backend
```

### Logs and Debugging

```bash
# View logs for all services
docker-compose logs

# View logs for specific service
docker-compose logs backend

# Follow logs in real-time
docker-compose logs -f frontend

# View last 100 lines
docker-compose logs --tail=100 postgres
```

### Execute Commands in Containers

```bash
# Access backend container shell
docker-compose exec backend /bin/bash

# Run database migration
docker-compose exec backend bun run db:migrate

# Access PostgreSQL shell
docker-compose exec postgres psql -U postgres -d mental_health
```

## 🔍 Monitoring & Health Checks

### Health Check Endpoints

- **Backend Health**: http://localhost:4000/api/health
- **Frontend**: http://localhost (should load the React app)
- **Database**: Accessible via backend health check

### Monitor Resource Usage

```bash
# Monitor container resource usage
docker stats

# Monitor specific containers
docker stats mental_health_backend mental_health_frontend

# View container processes
docker-compose top
```

### Health Check Response

The backend health endpoint returns:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600.123,
  "memory": {
    "rss": 45678912,
    "heapTotal": 12345678,
    "heapUsed": 8901234
  },
  "version": "1.0.0"
}
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Container Won't Start

```bash
# Check container logs
docker-compose logs backend

# Check container status
docker ps -a

# Restart container
docker-compose restart backend
```

#### 2. Database Connection Issues

```bash
# Check database is running
docker-compose ps postgres

# Test database connectivity
docker-compose exec backend ping postgres

# Check database logs
docker-compose logs postgres

# Verify environment variables
docker-compose exec backend env | grep DATABASE
```

#### 3. Port Already in Use

```bash
# Check what's using port 4000
netstat -tulpn | grep :4000  # Linux
netstat -ano | findstr :4000  # Windows

# Use different ports in docker-compose.yml
ports:
  - "4001:4000"  # Map to different host port
```

#### 4. Frontend Can't Connect to Backend

```bash
# Check nginx configuration
docker-compose exec frontend cat /etc/nginx/nginx.conf

# Verify backend is accessible
curl http://localhost:4000/api/health

# Check frontend environment variables
docker-compose exec frontend env | grep VITE
```

#### 5. Build Failures

```bash
# Clean build cache
docker builder prune

# Build with no cache
docker-compose build --no-cache

# Check Dockerfile syntax
docker build --dry-run .
```

### Performance Optimization

#### 1. Image Size Optimization

```dockerfile
# Use multi-stage builds
FROM oven/bun:1.1.29-slim as deps
# ... dependency installation

FROM oven/bun:1.1.29-slim as runtime
# ... final runtime stage
```

#### 2. Memory Limits

Add to `docker-compose.yml`:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
```

#### 3. Database Performance

```yaml
postgres:
  environment:
    POSTGRES_SHARED_PRELOAD_LIBRARIES: pg_stat_statements
    POSTGRES_MAX_CONNECTIONS: 100
  command: postgres -c shared_preload_libraries=pg_stat_statements
```

## ☁️ Cloud Deployment Options

### AWS ECS (Elastic Container Service)

1. **Push images to ECR:**
   ```bash
   # Create ECR repository
   aws ecr create-repository --repository-name mental-health-app

   # Build and push
   docker build -t mental-health-backend .
   docker tag mental-health-backend:latest your-account.dkr.ecr.region.amazonaws.com/mental-health-app:latest
   docker push your-account.dkr.ecr.region.amazonaws.com/mental-health-app:latest
   ```

2. **Create ECS task definition and service**

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
```

### Heroku Container Registry

```bash
# Login to Heroku Container Registry
heroku container:login

# Build and push
heroku container:push web --app your-app-name

# Release
heroku container:release web --app your-app-name
```

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Bun Runtime Documentation](https://bun.sh/docs)
- [Nginx Configuration Guide](https://nginx.org/en/docs/)
- [PostgreSQL Docker Hub](https://hub.docker.com/_/postgres)

## 🤝 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review container logs: `docker-compose logs`
3. Ensure all environment variables are set correctly
4. Verify Docker Desktop is running and up to date

For additional help, please check the project's issue tracker or documentation.

---

**Happy Deploying! 🚀**

*This guide covers Docker deployment for the Mental Health AI Chat Application. For other deployment methods, see the additional deployment guides in the `/deployment` folder.*