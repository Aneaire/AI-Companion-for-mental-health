@echo off

echo 🚀 Starting Docker deployment for Mental Health AI Chat Application
echo.

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: Docker is not running. Please start Docker Desktop and try again.
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist ".env" (
    echo ⚠️  Warning: .env file not found. Creating from .env.example
    copy ".env.example" ".env"
    echo ✅ Please edit .env file with your actual environment variables before proceeding.
    echo.
    pause
)

echo 🏗️  Building Docker images...
echo.

echo Building backend image...
docker build -t mental-health-backend . || (
    echo ❌ Failed to build backend image
    pause
    exit /b 1
)

echo Building frontend image...
docker build -t mental-health-frontend ./frontend || (
    echo ❌ Failed to build frontend image
    pause
    exit /b 1
)

echo.
echo ✅ Docker images built successfully!
echo.

echo 🚀 Starting services with Docker Compose...
echo.

REM Stop any existing containers
docker-compose down

REM Start services
docker-compose up -d || (
    echo ❌ Failed to start services
    pause
    exit /b 1
)

echo.
echo ✅ Deployment completed successfully!
echo.
echo 🌐 Your application is now running at:
echo    Frontend: http://localhost
echo    Backend:  http://localhost:4000
echo    Health:   http://localhost:4000/api/health
echo.
echo 📊 To view logs:
echo    docker-compose logs -f
echo.
echo 🛑 To stop the application:
echo    docker-compose down
echo.
pause