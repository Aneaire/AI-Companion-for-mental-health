# Deploying to Render

Render is a modern cloud platform that provides native support for Bun runtime, making it perfect for full-stack applications with integrated PostgreSQL databases.

## Prerequisites

- Render account (free tier available)
- GitHub repository
- PostgreSQL database (Render provides managed PostgreSQL)

## Step 1: Prepare Your Application

### Update Server Configuration

First, update your server to use Render's PORT environment variable:

```typescript
// server/index.ts
import app from "./app";

const port = process.env.PORT || 4000;

Bun.serve({
  fetch: app.fetch,
  port: port,
});

console.log(`Server is running on port ${port}`);
```

### Add Health Check Endpoint

Add a health check endpoint to your Hono app:

```typescript
// server/app.ts or where your Hono app is defined
app.get('/api/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'mental-health-ai-chat'
  });
});
```

### Update Package.json Scripts

Update your root `package.json` scripts:

```json
{
  "scripts": {
    "start": "bun server/index.ts",
    "build": "cd frontend && bun install && bun run build",
    "postinstall": "cd frontend && bun install",
    "db:migrate": "drizzle-kit generate && drizzle-kit push"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

## Step 2: Database Setup

Since you're using Supabase as your external database provider, you'll need to get your connection details from your Supabase dashboard.

### Using Supabase (Your Current Setup)

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to Settings → Database
4. Copy the connection string under "Connection String" → "URI"
5. The format should be: `postgresql://postgres:[YOUR-PASSWORD]@[HOST]:5432/postgres`

### Alternative External Database Providers

If you want to switch from Supabase, other options include:
- Neon (free tier available) 
- PlanetScale (free tier available)
- Aiven PostgreSQL
- ElephantSQL

## Step 3: Deployment Options

### Option A: Single Service Deployment (Recommended)

This approach deploys both frontend and backend as one service, with the backend serving static files.

#### 3.1 Create Web Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:

**Basic Settings:**
- **Name**: `mental-health-ai-chat`
- **Region**: Choose closest to your users
- **Branch**: `main`
- **Runtime**: `Bun`
- **Build Command**: `bun install && bun run build`
- **Start Command**: `bun run start`

**Advanced Settings:**
- **Instance Type**: Starter ($7/month) or higher
- **Auto-Deploy**: Yes (deploys on git push)

#### 3.2 Configure Environment Variables

Set these environment variables in the Render dashboard:

```env
# Database (Supabase)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres

# Authentication (Clerk)
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key

# AI Service (Google)
GOOGLE_AI_API_KEY=your_google_ai_api_key

# Runtime
NODE_ENV=production
BUN_VERSION=1.2.20

# Frontend Build Variables (for build time)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
VITE_API_BASE_URL=/api
```

**Note**: Replace the placeholders:
- `[YOUR-PASSWORD]`: Your Supabase database password
- `[YOUR-PROJECT-REF]`: Your Supabase project reference (found in your Supabase dashboard URL)
- Use your actual Clerk and Google AI API keys

#### 3.3 Update Server to Serve Frontend

Update your Hono app to serve static files:

```typescript
// server/app.ts
import { serveStatic } from 'hono/bun';

// Serve static files from frontend build
app.use('/assets/*', serveStatic({ root: './frontend/dist' }));
app.use('/favicon.ico', serveStatic({ path: './frontend/dist/favicon.ico' }));

// Serve index.html for all non-API routes (SPA routing)
app.get('*', serveStatic({ path: './frontend/dist/index.html' }));
```

### Option B: Separate Services (Advanced)

Deploy frontend and backend as separate services for better separation of concerns.

#### Backend Service
1. Create a Web Service as above but with:
   - **Build Command**: `bun install`
   - **Start Command**: `bun run start`

#### Frontend Service  
1. Create a Static Site:
   - **Build Command**: `cd frontend && bun install && bun run build`
   - **Publish Directory**: `frontend/dist`

Set frontend environment variables:
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
VITE_API_BASE_URL=https://your-backend-service.onrender.com/api
```

## Step 4: Database Migration

After deployment, run database migrations:

### Method 1: Through Render Shell
1. Go to your service dashboard
2. Click "Shell" tab
3. Run: `bun run db:migrate`

### Method 2: Add to Build Process
Add migration to your build script:

```json
{
  "scripts": {
    "build": "cd frontend && bun install && bun run build && bun run db:migrate"
  }
}
```

## Step 5: Custom Domain (Optional)

1. Go to your service → Settings
2. Click "Custom Domains"
3. Add your domain (e.g., `yourdomain.com`)
4. Configure DNS:
   ```
   # Add CNAME record in your DNS provider
   www.yourdomain.com → your-service.onrender.com
   
   # Or ALIAS/ANAME for apex domain
   yourdomain.com → your-service.onrender.com
   ```
5. SSL certificate is automatically provisioned

## Step 6: Environment-Specific Configuration

### Development vs Production

Create different Clerk applications and databases for each environment:

**Development:**
```env
NODE_ENV=development
DATABASE_URL=your_development_database_url
CLERK_SECRET_KEY=sk_test_development_key
```

**Production:**
```env
NODE_ENV=production  
DATABASE_URL=your_production_database_url
CLERK_SECRET_KEY=sk_live_production_key
```

## Monitoring and Maintenance

### Health Checks
Render automatically monitors your `/` endpoint. Configure custom health checks:

1. Go to service Settings
2. Set Health Check Path: `/api/health`

### View Logs
- **Dashboard**: Service → Logs tab
- **Real-time**: Use Render CLI or dashboard live logs

### Metrics
Monitor your service performance in the dashboard:
- Response times
- Memory usage
- CPU usage
- Request volume

## Scaling

### Automatic Scaling
Render can auto-scale based on CPU/memory usage:

1. Go to service Settings
2. Enable "Auto-Scale"
3. Set min/max instance counts

### Manual Scaling
Increase instance count manually for predictable traffic:

1. Service Settings → Instance Count
2. Choose number of instances (1-100)

## Troubleshooting

### Common Issues

#### 1. Build Failures
```bash
# Check build logs in Render dashboard
# Common fixes:
- Ensure all dependencies are in package.json
- Check Node.js/Bun version compatibility
- Verify build commands
```

#### 2. Database Connection Issues
```bash
# Verify DATABASE_URL format:
postgresql://username:password@host:port/database

# Check database status in Render dashboard
# Ensure database allows connections from your service
```

#### 3. Environment Variable Issues
```bash
# Verify all required environment variables are set
# Check variable names match exactly (case-sensitive)
# Restart service after changing environment variables
```

#### 4. Frontend Routing Issues (404s)
Ensure your server serves `index.html` for all non-API routes:

```typescript
// Catch-all route for SPA routing (must be last)
app.get('*', serveStatic({ path: './frontend/dist/index.html' }));
```

#### 5. CORS Issues
If using separate services, configure CORS in your backend:

```typescript
import { cors } from 'hono/cors';

app.use('/api/*', cors({
  origin: ['https://your-frontend.onrender.com'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['POST', 'GET', 'OPTIONS'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}));
```

### Performance Optimization

#### 1. Static Asset Optimization
```javascript
// vite.config.js
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-select']
        }
      }
    }
  }
}
```

#### 2. Database Connection Pooling
```typescript
// Configure connection pooling in your database setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

#### 3. Enable Compression
```typescript
import { compress } from 'hono/compress';

app.use(compress());
```

## Cost Management

### Pricing Tiers
- **Free**: $0/month (750 hours, sleeps after 15 minutes of inactivity)
- **Starter**: $7/month (always available, basic resources)
- **Standard**: $25/month (more resources, faster builds)
- **Pro**: $85/month (high performance, priority support)

### Database Pricing (Supabase)
- **Free**: $0/month (500MB database, 2GB bandwidth)
- **Pro**: $25/month (8GB database, 250GB bandwidth)
- **Team**: $599/month (unlimited projects)

Since you're using Supabase, you won't need to pay for Render's database pricing.

### Cost Optimization Tips
1. Use Render free tier for development/testing (with Supabase free tier)
2. Monitor resource usage in dashboard
3. Use auto-scaling to prevent over-provisioning
4. Since you're using Supabase, you only pay for Render's web service ($7/month for Starter)
5. Consider using Supabase's free tier for development and Pro tier for production

## Security Best Practices

### Environment Variables
- Store all secrets as environment variables
- Use different keys for development/production
- Rotate API keys regularly
- Never commit secrets to repository

### Database Security
- Use connection pooling
- Enable SSL connections in production
- Regular backups (automatic with paid plans)
- Monitor for unusual activity

### Network Security
- Enable HTTPS (automatic with custom domains)
- Configure CORS properly
- Implement rate limiting
- Use Clerk's built-in security features

## Render.yaml (Infrastructure as Code)

For advanced users, you can define your entire infrastructure in a `render.yaml` file:

```yaml
services:
  - type: web
    name: mental-health-ai-chat
    runtime: bun
    repo: https://github.com/your-username/your-repo.git
    buildCommand: bun install && bun run build
    startCommand: bun run start
    plan: starter
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: BUN_VERSION
        value: 1.2.20
      - key: DATABASE_URL
        fromDatabase:
          name: mental-health-db
          property: connectionString
      - key: CLERK_SECRET_KEY
        sync: false # This will be a secret
      - key: GOOGLE_AI_API_KEY
        sync: false
      - key: VITE_CLERK_PUBLISHABLE_KEY
        value: your_publishable_key
      - key: VITE_API_BASE_URL
        value: /api

# Note: Since you're using Supabase, you don't need the databases section
# Your DATABASE_URL environment variable will point to your Supabase instance
```

Deploy with: `render deploy`

## Next Steps

1. **Set up monitoring**: Configure alerts for downtime or performance issues
2. **Implement logging**: Add structured logging for better debugging
3. **Set up CI/CD**: Automate testing before deployment
4. **Performance monitoring**: Use tools like Sentry or LogRocket
5. **Backup strategy**: Ensure database backups are configured

## Additional Resources

- [Render Documentation](https://render.com/docs)
- [Bun Documentation](https://bun.sh/docs)
- [Hono Documentation](https://hono.dev)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [Clerk Authentication](https://clerk.com/docs)

---

This Render deployment provides automatic deployments, managed database, native Bun support, and excellent scaling capabilities for your Mental Health AI Chat application.