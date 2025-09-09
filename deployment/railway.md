# Deploying to Railway

Railway is a modern deployment platform with excellent support for full-stack applications and native Bun runtime support.

## Prerequisites

- Railway account
- GitHub repository
- PostgreSQL database (Railway provides one)

## Step 1: Database Setup

Railway provides integrated PostgreSQL:

1. Go to Railway dashboard
2. Create new project
3. Add PostgreSQL service
4. Note the connection variables for environment setup

## Step 2: Project Configuration

Create `railway.toml` in the root directory:

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "bun run start"
healthcheckPath = "/api/health"
healthcheckTimeout = 300

[[services]]
name = "backend"
source = "."
variables = { NODE_ENV = "production" }

[services.backend.build]
buildCommand = "bun install"

[[services]]
name = "frontend"
source = "./frontend"

[services.frontend.build]
buildCommand = "bun install && bun run build"
```

## Step 3: Environment Variables

Set up environment variables in Railway dashboard:

### Backend Service Variables
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
CLERK_SECRET_KEY=your_clerk_secret_key
GOOGLE_AI_API_KEY=your_google_ai_api_key
NODE_ENV=production
PORT=3000
```

### Frontend Service Variables
```
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
VITE_API_BASE_URL=https://your-backend.railway.app/api
```

## Step 4: Deployment Methods

### Method 1: GitHub Integration (Recommended)

1. Connect GitHub repository to Railway
2. Create new project from GitHub repo
3. Railway auto-detects Bun and configures build
4. Add PostgreSQL service from template
5. Configure environment variables
6. Deploy automatically on git push

### Method 2: Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add PostgreSQL
railway add postgresql

# Deploy
railway up

# Set environment variables
railway variables set CLERK_SECRET_KEY=your_key
railway variables set GOOGLE_AI_API_KEY=your_key
```

## Step 5: Build Configuration

Update your `package.json` scripts:

```json
{
  "scripts": {
    "start": "bun server/index.ts",
    "build": "bun install",
    "dev": "bun --watch server/index.ts"
  }
}
```

For frontend (`frontend/package.json`):

```json
{
  "scripts": {
    "build": "vite build && tsc",
    "preview": "vite preview --port $PORT"
  }
}
```

## Step 6: Database Migration

After deployment:

```bash
# Connect to Railway project
railway connect

# Run migrations
railway run bun run db:migrate

# Or using Railway CLI
railway shell
bun run db:migrate
```

## Step 7: Custom Domains

1. Go to project settings in Railway
2. Add custom domain
3. Configure DNS records:
   - Add CNAME record pointing to Railway domain
   - Wait for SSL certificate generation

## Advanced Configuration

### Multiple Services Setup

```yaml
# railway.yaml
services:
  backend:
    source: .
    build:
      buildCommand: bun install
    start:
      command: bun run start
    variables:
      NODE_ENV: production
    
  frontend:
    source: ./frontend
    build:
      buildCommand: bun install && bun run build
    start:
      command: bun run preview
```

### Health Checks

Add health check endpoint to your Hono server:

```typescript
// server/index.ts
app.get('/api/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString() 
  })
})
```

### Scaling Configuration

```toml
[deploy]
replicas = 1
healthcheckPath = "/api/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
```

## Monitoring and Logs

### View Logs
```bash
# Backend logs
railway logs

# Frontend logs  
railway logs --service frontend

# Follow logs in real-time
railway logs --follow
```

### Metrics Dashboard
- Access metrics from Railway dashboard
- Monitor CPU, memory, and network usage
- Set up alerts for performance thresholds

## Environment Management

### Multiple Environments
```bash
# Create staging environment
railway environment create staging

# Deploy to staging
railway up --environment staging

# Promote staging to production
railway environment promote staging production
```

### Variable Management
```bash
# List all variables
railway variables

# Set variable for specific service
railway variables set --service backend DATABASE_URL=new_url

# Copy variables between environments
railway variables copy --from staging --to production
```

## Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Check build logs
   railway logs --build
   
   # Rebuild from scratch
   railway up --detach
   ```

2. **Database Connection Issues**
   - Verify `DATABASE_URL` format
   - Check PostgreSQL service status
   - Test connection locally with Railway variables

3. **Memory Limits**
   - Monitor memory usage in dashboard
   - Optimize application memory consumption
   - Consider upgrading Railway plan

### Performance Optimization

1. **Static Assets**
   ```javascript
   // Serve static files efficiently
   app.use('/static/*', serveStatic({ root: './frontend/dist' }))
   ```

2. **Database Optimization**
   ```bash
   # Enable connection pooling
   railway variables set DATABASE_POOL_SIZE=20
   ```

## Cost Management

### Pricing Tiers
- **Hobby**: $5/month - Basic usage
- **Pro**: $20/month - Production apps  
- **Team**: $100/month - Team collaboration

### Resource Monitoring
- Track usage in Railway dashboard
- Set spending limits
- Optimize resource allocation

## Security Best Practices

1. **Environment Variables**
   - Never commit secrets to repository
   - Use Railway's secure variable storage
   - Rotate API keys regularly

2. **Network Security**
   ```toml
   [deploy]
   privateDomain = true  # Internal service communication
   ```

3. **Database Security**
   - Use connection pooling
   - Enable SSL for database connections
   - Regular backup scheduling

This Railway deployment provides automatic deployments, integrated database, and excellent developer experience with native Bun support.