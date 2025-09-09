# Deploying to Vercel

Vercel is excellent for full-stack applications with React frontends and supports Bun runtime for the backend.

## Prerequisites

- Vercel account
- GitHub repository
- PostgreSQL database (Vercel Postgres recommended)

## Step 1: Database Setup

### Option A: Vercel Postgres (Recommended)
1. Go to your Vercel dashboard
2. Navigate to Storage → Create Database → Postgres
3. Note the connection details for environment variables

### Option B: External Database
- Use Supabase, PlanetScale, or Neon
- Get connection string for environment variables

## Step 2: Project Configuration

Create `vercel.json` in the root directory:

```json
{
  "builds": [
    {
      "src": "frontend/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    },
    {
      "src": "server/index.ts",
      "use": "@vercel/bun"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "server/index.ts"
    },
    {
      "src": "/(.*)",
      "dest": "frontend/dist/$1"
    }
  ],
  "outputDirectory": "frontend/dist"
}
```

## Step 3: Environment Variables

Set up the following environment variables in Vercel:

### Backend Variables
```
DATABASE_URL=your_postgres_connection_string
CLERK_SECRET_KEY=your_clerk_secret_key
GOOGLE_AI_API_KEY=your_google_ai_api_key
NODE_ENV=production
```

### Frontend Variables
```
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
VITE_API_BASE_URL=https://your-app.vercel.app/api
```

## Step 4: Build Configuration

Update `frontend/package.json` build script:

```json
{
  "scripts": {
    "build": "vite build",
    "vercel-build": "bun run build"
  }
}
```

## Step 5: Deploy

### Method 1: Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Production deployment
vercel --prod
```

### Method 2: GitHub Integration
1. Connect your GitHub repository to Vercel
2. Import your project
3. Configure build settings:
   - Framework Preset: Other
   - Build Command: `cd frontend && bun run build`
   - Output Directory: `frontend/dist`
   - Install Command: `bun install`

## Step 6: Database Migration

After deployment, run migrations:

```bash
# Using Vercel CLI
vercel env pull .env.local
bun run db:migrate
```

## Post-Deployment

1. Test all API endpoints
2. Verify database connection
3. Check Clerk authentication
4. Monitor function logs in Vercel dashboard

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Ensure all dependencies are in `package.json`
   - Check TypeScript compilation errors
   - Verify environment variables

2. **Database Connection**
   - Verify `DATABASE_URL` format
   - Check IP allowlisting for external databases
   - Test connection locally first

3. **API Routes Not Working**
   - Verify `vercel.json` routing configuration
   - Check function timeout limits
   - Review server logs

### Performance Optimization

1. Enable Edge Runtime for API routes:
```typescript
export const runtime = 'edge'
```

2. Optimize frontend bundle:
```typescript
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

## Cost Considerations

- Vercel Pro: $20/month per member
- Function execution time limits
- Bandwidth usage
- Database storage (Vercel Postgres pricing)

## Monitoring

- Use Vercel Analytics for performance tracking
- Set up error monitoring with Sentry
- Monitor function execution times
- Track database performance