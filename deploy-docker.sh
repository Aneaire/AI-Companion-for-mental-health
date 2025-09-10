#!/bin/bash

# Mental Health AI Chat Application - Docker Deployment Script

echo "🚀 Starting Docker deployment for Mental Health AI Chat Application"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found. Creating from .env.example"
    cp .env.example .env
    echo "✅ Please edit .env file with your actual environment variables before proceeding."
    echo ""
    read -p "Press Enter to continue after updating .env file..."
fi

echo "🏗️  Building Docker images..."
echo ""

# Build backend image
echo "Building backend image..."
docker build -t mental-health-backend . || {
    echo "❌ Failed to build backend image"
    exit 1
}

# Build frontend image
echo "Building frontend image..."
docker build -t mental-health-frontend ./frontend || {
    echo "❌ Failed to build frontend image"
    exit 1
}

echo ""
echo "✅ Docker images built successfully!"
echo ""

# Start services with docker-compose
echo "🚀 Starting services with Docker Compose..."
echo ""

# Stop any existing containers
docker-compose down

# Start services
docker-compose up -d || {
    echo "❌ Failed to start services"
    exit 1
}

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "🌐 Your application is now running at:"
echo "   Frontend: http://localhost"
echo "   Backend:  http://localhost:4000"
echo "   Health:   http://localhost:4000/api/health"
echo ""
echo "📊 To view logs:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 To stop the application:"
echo "   docker-compose down"
echo ""