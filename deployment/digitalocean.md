# Deploying to DigitalOcean

DigitalOcean App Platform provides a Platform-as-a-Service solution that's great for full-stack applications with database integration.

## Prerequisites

- DigitalOcean account
- GitHub repository  
- Credit card for billing (free tier available)

## Step 1: Database Setup

### Option A: DigitalOcean Managed PostgreSQL (Recommended)
1. Go to DigitalOcean Control Panel
2. Navigate to Databases → Create Database Cluster
3. Choose PostgreSQL, select region and size
4. Note connection details for environment variables

### Option B: External Database
- Use Supabase, PlanetScale, or other managed database
- Get connection string for environment setup

## Step 2: Project Configuration

Create `.do/app.yaml` in the root directory:

```yaml
name: mental-health-ai-chat
services:
- name: backend
  source_dir: /
  github:
    repo: your-username/your-repo
    branch: main
  run_command: bun run start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NODE_ENV
    value: production
  - key: DATABASE_URL
    value: ${db.DATABASE_URL}
  - key: CLERK_SECRET_KEY
    scope: RUN_TIME
    type: SECRET
  - key: GOOGLE_AI_API_KEY
    scope: RUN_TIME
    type: SECRET

- name: frontend
  source_dir: /frontend
  github:
    repo: your-username/your-repo
    branch: main
  build_command: bun install && bun run build
  run_command: bun run preview --port $PORT
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  routes:
  - path: /
  envs:
  - key: VITE_CLERK_PUBLISHABLE_KEY
    scope: BUILD_TIME
  - key: VITE_API_BASE_URL
    value: ${backend.PUBLIC_URL}/api

databases:
- name: db
  engine: PG
  version: "13"
  size: db-s-dev-database
```

## Step 3: Deployment Methods

### Method 1: DigitalOcean Control Panel (Recommended)

1. **Create App**
   - Go to Apps → Create App
   - Choose "From Source Code"
   - Connect GitHub repository

2. **Configure Resources**
   - App Platform auto-detects Node.js
   - Add PostgreSQL database from Resources tab
   - Configure environment variables

3. **Review and Deploy**
   - Review configuration
   - Click "Create Resources"
   - Wait for deployment to complete

### Method 2: DigitalOcean CLI (doctl)

```bash
# Install doctl
# Windows: Download from GitHub releases
# macOS: brew install doctl
# Linux: snap install doctl

# Authenticate
doctl auth init

# Create app from spec
doctl apps create --spec .do/app.yaml

# List apps
doctl apps list

# Get app info
doctl apps get <app-id>
```

## Step 4: Environment Variables Setup

Configure these environment variables in the DigitalOcean control panel:

### Backend Environment Variables
```
NODE_ENV=production
DATABASE_URL=${db.DATABASE_URL}
CLERK_SECRET_KEY=your_clerk_secret_key
GOOGLE_AI_API_KEY=your_google_ai_api_key
PORT=8080
```

### Frontend Environment Variables  
```
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
VITE_API_BASE_URL=${backend.PUBLIC_URL}/api
```

## Step 5: Build Configuration

Update your build scripts to work with App Platform:

### Root `package.json`:
```json
{
  "scripts": {
    "start": "bun server/index.ts",
    "build": "bun install",
    "postbuild": "bun run db:migrate"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Frontend `package.json`:
```json
{
  "scripts": {
    "build": "vite build && tsc",
    "preview": "vite preview --host 0.0.0.0 --port $PORT"
  }
}
```

## Step 6: Database Migration

App Platform runs post-build scripts automatically:

```bash
# Add to package.json scripts
"postbuild": "bun run db:migrate"
```

Or run manually after deployment:
```bash
# Using doctl
doctl apps create-deployment <app-id>

# Or through the console
# Apps → Your App → Console tab
bun run db:migrate
```

## Step 7: Custom Domain Setup

1. **Add Domain in App Platform**
   - Go to Settings → Domains
   - Add your custom domain
   - Choose which service to route to

2. **Configure DNS**
   ```
   # Add CNAME record in your DNS provider
   www.yourdomain.com → your-app-hash.ondigitalocean.app
   
   # Or A record for apex domain
   yourdomain.com → <app-platform-ip>
   ```

3. **SSL Certificate**
   - App Platform automatically provisions Let's Encrypt SSL
   - Certificate renewal is handled automatically

## Step 8: Monitoring and Scaling

### App Metrics
- View metrics in DigitalOcean control panel
- Monitor CPU, memory, and request metrics
- Set up alerts for resource usage

### Auto-scaling Configuration
```yaml
# Add to .do/app.yaml
services:
- name: backend
  autoscaling:
    min_instance_count: 1
    max_instance_count: 3
    metrics:
    - cpu:
        percent: 80
```

### Log Management
```bash
# View logs using doctl
doctl apps logs <app-id> --follow

# Or view in control panel
# Apps → Your App → Runtime Logs
```

## Advanced Configuration

### Health Checks
```yaml
# Add to service configuration
health_check:
  http_path: /api/health
  initial_delay_seconds: 30
  period_seconds: 10
  timeout_seconds: 5
  success_threshold: 1
  failure_threshold: 3
```

### Worker Services
```yaml
# For background jobs
- name: worker
  source_dir: /
  run_command: bun run worker
  instance_count: 1
  instance_size_slug: basic-xxs
```

### Static File Serving
```yaml
# For serving static assets
- name: static
  source_dir: /frontend/dist
  environment_slug: static
  routes:
  - path: /static
```

## Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Check build logs
   doctl apps logs <app-id> --type build
   
   # Common fixes:
   # - Ensure all dependencies are in package.json
   # - Check Node.js version compatibility
   # - Verify build commands
   ```

2. **Database Connection Issues**
   ```bash
   # Test database connection
   doctl databases connection-pools list <database-id>
   
   # Check connection string format
   # Ensure ${db.DATABASE_URL} is properly set
   ```

3. **Environment Variable Issues**
   ```bash
   # List environment variables
   doctl apps spec get <app-id>
   
   # Update environment variables
   doctl apps update <app-id> --spec updated-app.yaml
   ```

### Performance Optimization

1. **Database Connection Pooling**
   ```typescript
   // Configure in your database setup
   const pool = new Pool({
     connectionString: process.env.DATABASE_URL,
     max: 20,
     idleTimeoutMillis: 30000,
     connectionTimeoutMillis: 2000,
   });
   ```

2. **Static Asset Optimization**
   ```javascript
   // vite.config.js
   export default {
     build: {
       rollupOptions: {
         output: {
           manualChunks: {
             vendor: ['react', 'react-dom'],
             ui: ['@radix-ui/react-dialog']
           }
         }
       }
     }
   }
   ```

## Cost Management

### Pricing Tiers
- **Basic**: $5/month - 512MB RAM, 1 vCPU
- **Professional**: $12/month - 1GB RAM, 1 vCPU  
- **Work**: $25/month - 2GB RAM, 2 vCPU

### Database Pricing
- **Development**: $15/month - 1GB RAM, 1 vCPU, 10GB storage
- **Basic**: $25/month - 2GB RAM, 1 vCPU, 25GB storage

### Cost Optimization Tips
1. Use development database for staging
2. Configure auto-scaling to prevent over-provisioning
3. Monitor usage with alerts
4. Use CDN for static assets

## Security Best Practices

### Environment Variables
```yaml
# Use secrets for sensitive data
envs:
- key: CLERK_SECRET_KEY
  scope: RUN_TIME
  type: SECRET
- key: DATABASE_PASSWORD  
  scope: RUN_TIME
  type: SECRET
```

### Database Security
```yaml
# Enable trusted sources only
databases:
- name: db
  engine: PG
  trusted_sources:
  - name: backend
    type: app
```

### Network Security
```yaml
# Configure firewall rules
firewall:
  inbound_rules:
  - protocol: tcp
    ports: "443"
    sources:
      addresses: ["0.0.0.0/0"]
```

This DigitalOcean deployment provides managed infrastructure, automatic scaling, and integrated database with excellent developer experience.