@echo off

echo 🔧 Docker Desktop Troubleshooting Script
echo.

echo Checking Docker Desktop status...
docker info >nul 2>&1

if %errorlevel% neq 0 (
    echo ❌ Docker Desktop is not running
    echo.
    echo 🚀 Starting Docker Desktop...
    echo.
    
    rem Try to start Docker Desktop
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    
    echo ⏳ Waiting for Docker Desktop to start...
    echo    This may take 30-60 seconds...
    echo.
    
    rem Wait for Docker to be ready
    :wait_loop
    timeout /t 5 >nul
    docker info >nul 2>&1
    if %errorlevel% neq 0 (
        echo    Still starting...
        goto wait_loop
    )
    
    echo ✅ Docker Desktop is now running!
    echo.
) else (
    echo ✅ Docker Desktop is already running
    echo.
)

echo 📊 Docker Information:
docker version --format "{{.Client.Version}}"

echo.
echo 🐳 Ready to deploy! Run the following command:
echo    docker-compose up -d --build
echo.

pause