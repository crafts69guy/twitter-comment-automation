#!/bin/bash

# Twitter Comment Automation - Docker Startup Script
echo "🐳 Starting Twitter Comment Automation with Docker..."

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker Desktop first."
  exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
  echo "⚠️  .env file not found. Creating from template..."
  cp .env.example .env
  echo "📝 Please edit .env file with your API keys before continuing."
  echo "   Required: GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY"
  echo "   Required: SESSION_SECRET"
  exit 1
fi

# Check if environment variables are set
source .env
if [ -z "$SESSION_SECRET" ]; then
  echo "❌ SESSION_SECRET not set in .env file"
  exit 1
fi

if [ -z "$GEMINI_API_KEY" ] && [ -z "$OPENAI_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "❌ At least one AI API key must be set in .env file"
  exit 1
fi

# Build and start services
echo "🏗️  Building Docker images..."
docker-compose build

echo "🚀 Starting services..."
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to start..."
sleep 10

# Check if services are running
if docker-compose ps | grep -q "Up"; then
  echo "✅ Services started successfully!"
  echo ""
  echo "🌐 Application URLs:"
  echo "   Frontend: http://localhost:80"
  echo "   Backend:  http://localhost:3001/api/health"
  echo ""
  echo "📊 To view logs: docker-compose logs -f"
  echo "⏹️  To stop:     docker-compose down"
else
  echo "❌ Failed to start services. Check logs with: docker-compose logs"
  exit 1
fi

