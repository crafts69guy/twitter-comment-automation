# 🐳 Docker Setup Guide

This guide will help you run the Twitter Comment Automation application using Docker, making it easy to share and deploy.

## 📋 Prerequisites

- **Docker**: Install Docker Desktop from [docker.com](https://www.docker.com/products/docker-desktop/)
- **Docker Compose**: Included with Docker Desktop
- **Git**: To clone the repository

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd twitter-comment-automation
```

### 2. Configure Environment Variables

```bash
# Copy the environment template
cp .env.example .env

# Edit the .env file with your API keys
nano .env  # or use your preferred editor
```

**Required Environment Variables:**

```env
# At least one AI API key is required
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Session secret (use a random 32+ character string)
SESSION_SECRET=your_super_secret_session_key_here_minimum_32_characters
```

### 3. Build and Run

```bash
# Build and start all services
docker-compose up --build

# Or run in background
docker-compose up -d --build
```

### 4. Access the Application

- **Frontend**: http://localhost:80
- **Backend API**: http://localhost:3001/api/health

## 🛠️ Available Commands

### Development

```bash
# Start in development mode with live reloading
docker-compose up --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild specific service
docker-compose build backend
docker-compose build frontend
```

### Production

```bash
# Run with production optimizations
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Scale services (if needed)
docker-compose up --scale backend=2
```

### Maintenance

```bash
# Remove containers and volumes
docker-compose down -v

# Clean up everything (containers, networks, images)
docker-compose down -v --rmi all

# View service status
docker-compose ps

# Execute commands in running containers
docker-compose exec backend npm run dev
docker-compose exec frontend sh
```

## 📁 Project Structure

```
twitter-comment-automation/
├── backend/
│   ├── Dockerfile              # Backend container config
│   ├── .dockerignore          # Files to exclude from build
│   └── package.json           # Dependencies
├── frontend/
│   ├── Dockerfile             # Frontend container config
│   ├── nginx.conf             # Nginx configuration
│   ├── .dockerignore          # Files to exclude from build
│   └── package.json           # Dependencies
├── docker-compose.yml         # Main Docker Compose config
├── docker-compose.prod.yml    # Production overrides
├── .env.example              # Environment template
└── DOCKER_SETUP.md           # This file
```

## 🔧 Configuration Details

### Backend Container

- **Image**: Node.js 18 Alpine
- **Port**: 3001
- **Features**:
  - Puppeteer with Chromium
  - Health checks
  - Non-root user security
  - Volume mounting for persistent data

### Frontend Container

- **Image**: Nginx Alpine
- **Port**: 80
- **Features**:
  - Multi-stage build (build + serve)
  - Gzip compression
  - SPA routing support
  - API proxy to backend
  - Security headers

### Networking

- **Internal Network**: Services communicate via `app-network`
- **API Routing**: Frontend proxies `/api/*` requests to backend
- **Health Checks**: Both services have health monitoring

## 🔐 Security Features

- **Non-root users** in containers
- **Security headers** in nginx
- **Environment variable** protection
- **Resource limits** in production
- **Network isolation** between services

## 🚢 Sharing Your Application

### Method 1: Share Docker Images

```bash
# Build and tag images
docker build -t your-username/twitter-automation-backend ./backend
docker build -t your-username/twitter-automation-frontend ./frontend

# Push to Docker Hub
docker push your-username/twitter-automation-backend
docker push your-username/twitter-automation-frontend
```

### Method 2: Share Source Code + Docker Setup

1. **Push to GitHub** with all Docker files
2. **Share the repository URL**
3. **Recipients follow the Quick Start guide**

### Method 3: Export Docker Images

```bash
# Save images to files
docker save -o backend.tar your-username/twitter-automation-backend
docker save -o frontend.tar your-username/twitter-automation-frontend

# Recipients load images
docker load -i backend.tar
docker load -i frontend.tar
```

## 🐛 Troubleshooting

### Common Issues

**1. Port Already in Use**

```bash
# Check what's using port 80
sudo lsof -i :80

# Use different ports
docker-compose -f docker-compose.yml up --build -p 8080:80
```

**2. Build Failures**

```bash
# Clean Docker cache
docker system prune -a

# Rebuild without cache
docker-compose build --no-cache
```

**3. Puppeteer Issues**

```bash
# Check backend logs
docker-compose logs backend

# The Dockerfile includes Chromium setup for Alpine Linux
```

**4. API Connection Issues**

```bash
# Verify backend is running
curl http://localhost:3001/api/health

# Check network connectivity
docker-compose exec frontend ping backend
```

### Environment Variable Issues

```bash
# Verify environment variables are loaded
docker-compose exec backend printenv | grep API_KEY

# Restart with new environment
docker-compose down && docker-compose up
```

## 📊 Monitoring

### Health Checks

```bash
# Check service health
docker-compose ps

# View health check logs
docker inspect twitter-automation-backend | grep Health -A 10
```

### Resource Usage

```bash
# Monitor container resources
docker stats

# View container logs
docker-compose logs -f --tail=100
```

## 🔄 Updates and Maintenance

### Updating the Application

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose up --build -d
```

### Backup Data

```bash
# Backup volumes
docker run --rm -v twitter-comment-automation_backend-data:/data -v $(pwd):/backup alpine tar czf /backup/backup.tar.gz /data
```

## 🆘 Support

If you encounter issues:

1. **Check logs**: `docker-compose logs -f`
2. **Verify environment**: Ensure `.env` file is properly configured
3. **Check ports**: Make sure ports 80 and 3001 are available
4. **Resource limits**: Ensure Docker has enough memory (recommended: 4GB+)

## 🎯 Production Deployment

For production deployment, consider:

1. **Use docker-compose.prod.yml** for optimizations
2. **Set up SSL certificates** for HTTPS
3. **Configure monitoring** (Prometheus, Grafana)
4. **Set up log aggregation** (ELK stack)
5. **Use container orchestration** (Docker Swarm, Kubernetes)
6. **Implement CI/CD** for automated deployments

---

**Happy Dockerizing! 🐳✨**

