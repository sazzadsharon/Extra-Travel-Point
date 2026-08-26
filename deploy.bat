@echo off
REM ============================================
REM Extra Travel Point - Free Deploy (Windows)
REM ============================================

echo.
echo 🚀 Extra Travel Point - Free Deployment
echo =======================================
echo.

REM Check prerequisites
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ npm is not installed
    exit /b 1
)

echo ✓ Prerequisites OK
echo.

echo Select deployment option:
echo 1) Setup Backend for Development
echo 2) Show Render.com Instructions
echo 3) Show Supabase Instructions
echo 4) Show Vercel Instructions
echo 5) Full Development Setup
echo.

set /p choice="Enter choice [1-5]: "

if "%choice%"=="1" goto setup_backend
if "%choice%"=="2" goto render
if "%choice%"=="3" goto supabase
if "%choice%"=="4" goto vercel
if "%choice%"=="5" goto full_setup

echo Invalid choice
exit /b 1

:setup_backend
echo.
echo 📦 Setting up Backend...
cd backend

if not exist .env (
    copy .env.example .env
    echo ⚠ Please edit backend/.env with your configuration
)

call npm install
call npm run prisma:generate
call npm run db:push
call npm run prisma:seed

echo.
echo ✓ Backend setup complete!
echo Start: cd backend && npm run dev
goto end

:render
echo.
echo 📋 Render.com Deployment Steps:
echo =================================
echo 1. Go to https://render.com and sign up
echo 2. Click "New +" → "Web Service"
echo 3. Connect your GitHub repo
echo 4. Settings:
echo    - Name: etp-backend
echo    - Root Directory: backend
echo    - Build Command: npm install && npm run build && npm run prisma:generate && npm run prisma:deploy
echo    - Start Command: npm start
echo 5. Add Environment Variables:
echo    - NODE_ENV=production
echo    - DATABASE_URL=your_supabase_url
echo    - JWT_SECRET=your_secret
echo 6. Click "Create Web Service"
goto end

:supabase
echo.
echo 📋 Supabase Setup Steps:
echo =========================
echo 1. Go to https://supabase.com and sign up
echo 2. Create New Project
echo 3. Region: Singapore (closest to Bangladesh)
echo 4. Copy the database URL
echo 5. Format: postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
goto end

:vercel
echo.
echo 📋 Vercel (Admin Panel) Deployment:
echo ====================================
echo 1. Go to https://vercel.com and sign up
echo 2. Import your GitHub repo
echo 3. Framework: Next.js
echo 4. Root Directory: admin-panel
echo 5. Environment Variables:
echo    - NEXT_PUBLIC_API_URL=https://your-render-url.onrender.com
echo 6. Click "Deploy"
goto end

:full_setup
echo.
echo 📦 Setting up Backend...
cd backend

if not exist .env (
    copy .env.example .env
)

call npm install
call npm run prisma:generate
call npm run db:push
call npm run prisma:seed

echo.
echo ✓ Development environment ready!
echo.
echo Start backend: cd backend && npm run dev
echo.
echo Demo credentials:
echo   Admin:    01712345678 / admin123
echo   Customer: 01812345678 / customer123
echo   Vendor:   01912345678 / vendor123
goto end

:end
echo.
pause
