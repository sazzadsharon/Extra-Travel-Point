#!/bin/bash
# ============================================
# Extra Travel Point - Free Deploy Script
# ============================================
# This script helps deploy to free tier services

set -e

echo "🚀 Extra Travel Point - Free Deployment"
echo "======================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."
    
    if ! command -v git &> /dev/null; then
        echo -e "${RED}❌ git is not installed${NC}"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js is not installed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Prerequisites OK${NC}"
    echo ""
}

# Setup backend
setup_backend() {
    echo "📦 Setting up Backend..."
    cd backend
    
    if [ ! -f .env ]; then
        cp .env.example .env
        echo -e "${YELLOW}⚠ Please edit backend/.env with your configuration${NC}"
    fi
    
    npm install
    npm run prisma:generate
    npm run db:push
    npm run prisma:seed
    
    echo -e "${GREEN}✓ Backend setup complete${NC}"
    echo ""
}

# Docker deploy
docker_deploy() {
    echo "🐳 Deploying with Docker Compose..."
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        exit 1
    fi
    
    docker-compose -f docker-compose.prod.yml up -d --build
    
    echo -e "${GREEN}✓ Docker deployment complete${NC}"
    echo ""
    echo "Services:"
    echo "  - Backend: http://localhost:5000"
    echo "  - Health: http://localhost:5000/health"
}

# Render deploy instructions
render_instructions() {
    echo ""
    echo "📋 Render.com Deployment Steps:"
    echo "================================="
    echo "1. Go to https://render.com and sign up"
    echo "2. Click 'New +' → 'Web Service'"
    echo "3. Connect your GitHub repo"
    echo "4. Settings:"
    echo "   - Name: etp-backend"
    echo "   - Root Directory: backend"
    echo "   - Build Command: npm install && npm run build && npm run prisma:generate && npm run prisma:deploy"
    echo "   - Start Command: npm start"
    echo "5. Add Environment Variables:"
    echo "   - NODE_ENV=production"
    echo "   - DATABASE_URL=your_supabase_url"
    echo "   - JWT_SECRET=your_secret"
    echo "6. Click 'Create Web Service'"
    echo ""
}

# Supabase instructions
supabase_instructions() {
    echo ""
    echo "📋 Supabase Setup Steps:"
    echo "========================="
    echo "1. Go to https://supabase.com and sign up"
    echo "2. Create New Project"
    echo "3. Region: Singapore (closest to Bangladesh)"
    echo "4. Copy the database URL"
    echo "5. Format: postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"
    echo ""
}

# Vercel instructions
vercel_instructions() {
    echo ""
    echo "📋 Vercel (Admin Panel) Deployment:"
    echo "===================================="
    echo "1. Go to https://vercel.com and sign up"
    echo "2. Import your GitHub repo"
    echo "3. Framework: Next.js"
    echo "4. Root Directory: admin-panel"
    echo "5. Environment Variables:"
    echo "   - NEXT_PUBLIC_API_URL=https://your-render-url.onrender.com"
    echo "6. Click 'Deploy'"
    echo ""
}

# Main menu
main() {
    check_prerequisites
    
    echo "Select deployment option:"
    echo "1) Local Docker Deploy (requires Docker)"
    echo "2) Setup for Render.com (Free Cloud)"
    echo "3) Setup for Supabase (Free Database)"
    echo "4) Setup for Vercel (Free Frontend Hosting)"
    echo "5) Full Setup (Local Development)"
    echo ""
    read -p "Enter choice [1-5]: " choice
    
    case $choice in
        1)
            setup_backend
            docker_deploy
            ;;
        2)
            setup_backend
            render_instructions
            ;;
        3)
            setup_backend
            supabase_instructions
            ;;
        4)
            vercel_instructions
            ;;
        5)
            setup_backend
            echo -e "${GREEN}✓ Development environment ready!${NC}"
            echo ""
            echo "Start backend: cd backend && npm run dev"
            echo ""
            echo "Demo credentials:"
            echo "  Admin:    01712345678 / admin123"
            echo "  Customer: 01812345678 / customer123"
            echo "  Vendor:   01912345678 / vendor123"
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            exit 1
            ;;
    esac
}

main
