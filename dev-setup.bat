@echo off

echo 🚀 Mental Health AI Chat - Development Setup (Supabase)
echo.

REM Check if .env file exists
if not exist ".env" (
    echo ⚠️  Warning: .env file not found. Creating from .env.example
    copy ".env.example" ".env"
    echo.
    echo ✅ Please edit .env file with your Supabase database URL and API keys:
    echo    - DATABASE_URL: Get from Supabase Settings ^> Database ^> Connection string
    echo    - GOOGLE_AI_API_KEY: Get from Google AI Studio
    echo    - CLERK_SECRET_KEY: Get from Clerk Dashboard
    echo    - VITE_CLERK_PUBLISHABLE_KEY: Get from Clerk Dashboard
    echo.
    pause
)

echo 📦 Installing dependencies...
echo.

REM Install backend dependencies
echo Installing backend dependencies...
bun install

echo.
echo 🗄️  Running database migrations...
bun run db:migrate

echo.
echo ✅ Setup complete!
echo.
echo 🚀 To start development:
echo.
echo    1. Backend: bun run dev
echo    2. Frontend: cd frontend ^&^& bun run dev
echo.
echo 📋 Development URLs:
echo    - Frontend: http://localhost:3000
echo    - Backend:  http://localhost:3001
echo    - Health:   http://localhost:3001/api/health
echo.

pause