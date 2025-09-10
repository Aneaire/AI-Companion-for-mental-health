# 🔧 Vercel Deployment Troubleshooting

## 🚨 Current Issue: 500 Internal Server Error

**Error Code**: `FUNCTION_INVOCATION_FAILED`
**Symptoms**: All API endpoints returning 500 errors, serverless function crashes

## 🔍 Root Causes & Solutions

### 1. **API Import Issues** ✅ FIXED
**Problem**: Original API was importing all Hono routes which caused dependency crashes
**Solution**: Created minimal API endpoints that work in serverless environment

### 2. **Environment Variables**
Check these are set in your Vercel dashboard:

```env
# Required for API functionality
DATABASE_URL=postgresql://postgres:[password]@[host]:[port]/[database]
CLERK_SECRET_KEY=sk_test_...
GOOGLE_AI_API_KEY=AIza...
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
NODE_ENV=production
```

### 3. **Database Connection**
Test database connection: `https://your-app.vercel.app/api/db-test`

### 4. **Serverless Function Configuration**
Current vercel.json configuration:
```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/index"
    }
  ],
  "outputDirectory": "frontend/dist",
  "installCommand": "bun install && cd frontend && bun install",
  "buildCommand": "cd frontend && bun run build"
}
```

## 🛠️ Step-by-Step Fix Process

### Step 1: Test Basic API
Visit: `https://your-app.vercel.app/api/health`

**Expected Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-09-10T...",
  "uptime": 123.456,
  "memory": {...},
  "version": "unknown",
  "environment": "production"
}
```

### Step 2: Test Environment Variables  
Visit: `https://your-app.vercel.app/api/test`

**Should show**:
```json
{
  "message": "API is working",
  "environment": {
    "NODE_ENV": "production",
    "DATABASE_URL": "configured",
    "CLERK_SECRET_KEY": "configured", 
    "GOOGLE_AI_API_KEY": "configured"
  }
}
```

### Step 3: Test Database
Visit: `https://your-app.vercel.app/api/db-test`

**Expected**: Connection success or specific error message

### Step 4: Check Vercel Logs
1. Go to Vercel Dashboard
2. Select your project
3. Go to "Functions" tab
4. Check logs for detailed error messages

## 🔧 Quick Fixes

### Fix 1: Redeploy with Fixed API
The API has been simplified to avoid import crashes. Latest commit should fix the 500 errors.

### Fix 2: Environment Variables
In Vercel Dashboard → Settings → Environment Variables:

1. **Add missing variables** if any show "not configured"
2. **Redeploy** after adding variables

### Fix 3: Database Connection
If DATABASE_URL is wrong:
1. Get correct URL from Supabase
2. Format: `postgresql://postgres:[password]@[host]:[port]/[database]`
3. Update in Vercel environment variables
4. Redeploy

### Fix 4: Force Redeploy
```bash
# Push empty commit to trigger redeploy
git commit --allow-empty -m "Force redeploy to fix API"
git push origin main
```

## 📊 Testing Endpoints

### Basic Health Check
```bash
curl https://your-app.vercel.app/api/health
```

### Environment Test
```bash
curl https://your-app.vercel.app/api/test
```

### Database Test
```bash
curl https://your-app.vercel.app/api/db-test
```

## 🚨 Emergency Rollback

If issues persist, rollback to working local version:

### Option 1: Local Development
```bash
# Use local development until API is fixed
bun run dev  # Backend on :3001
cd frontend && bun run dev  # Frontend on :3000
```

### Option 2: Restore Complex API
```bash
# Restore the full API (if needed)
cp api/index.backup.ts api/index.ts
git add api/index.ts
git commit -m "Restore full API functionality"
git push origin main
```

## 🔍 Debugging Commands

### Check Vercel Deployment Status
```bash
vercel ls
```

### View Function Logs
```bash
vercel logs your-app-name
```

### Test Locally with Vercel
```bash
vercel dev
```

## ✅ Success Indicators

Your deployment is working when:
- [ ] `/api/health` returns 200 status
- [ ] `/api/test` shows environment variables as "configured" 
- [ ] `/api/db-test` connects successfully
- [ ] Frontend loads without API errors
- [ ] User authentication works
- [ ] Database queries succeed

## 🆘 Still Having Issues?

### 1. Check Function Timeout
Serverless functions have 10s timeout limit. Long database operations might timeout.

### 2. Check Memory Usage
Monitor function memory usage in Vercel dashboard.

### 3. Dependency Issues
Some packages don't work in serverless environment. The simplified API avoids these issues.

### 4. Contact Support
If issues persist:
1. Check Vercel Status page
2. Review Vercel documentation
3. Consider alternative deployment (Railway, Render)

---

**🎯 Next Steps**: After API is working, gradually restore full functionality by adding routes one by one.