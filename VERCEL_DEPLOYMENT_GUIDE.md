# Vercel Deployment Guide

This guide will walk you through deploying your AI Smart Therapist application to Vercel.

## ✅ Prerequisites Completed

Your application has been prepared for Vercel deployment with the following changes:
- ✅ Fixed missing dependencies (zustand, hono, react-markdown)
- ✅ Created `vercel.json` configuration file using serverless functions approach
- ✅ Created `api/index.ts` Vercel-compatible API handler
- ✅ Updated CORS configuration to allow Vercel domains
- ✅ Updated build scripts to skip TypeScript checks
- ✅ Optimized build configuration with code splitting
- ✅ Tested successful frontend build

## 🚀 Deployment Steps

### Step 1: Prepare Your Repository

1. **Commit and push your changes to GitHub:**
   ```bash
   git add .
   git commit -m "Prepare application for Vercel deployment"
   git push origin main
   ```

### Step 2: Set Up Vercel Account

1. Go to [vercel.com](https://vercel.com)
2. Sign up or log in with your GitHub account
3. Give Vercel permission to access your repositories

### Step 3: Import Your Project

1. Click **"New Project"** in your Vercel dashboard
2. Select **"Import Git Repository"**
3. Choose your `capstone` repository
4. Configure the import settings:
   - **Framework Preset:** Other
   - **Root Directory:** Leave empty (uses root)
   - **Build Command:** `cd frontend && bun run build`
   - **Output Directory:** `frontend/dist`
   - **Install Command:** `bun install`
   - **Node.js Version:** 18.x (recommended)

### Step 4: Configure Environment Variables

In your Vercel project settings, add these environment variables:

#### Backend Variables
```
DATABASE_URL=your_postgres_connection_string
CLERK_SECRET_KEY=your_clerk_secret_key
GEMINI_API_KEY=your_google_gemini_api_key
ANTHROPIC_KEY=your_anthropic_api_key
NODE_ENV=production
```

#### Frontend Variables
```
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
VITE_API_BASE_URL=https://your-app-name.vercel.app/api
```

#### Optional (if using Supabase)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
DATABASE_PASSWORD=your_database_password
```

### Step 5: Set Up Database

#### Option A: Vercel Postgres (Recommended)
1. In your Vercel dashboard, go to **Storage**
2. Click **"Create Database"** → **"Postgres"**
3. Note the connection string for `DATABASE_URL`

#### Option B: Use Existing Supabase Database
- Use your existing Supabase connection string
- Ensure your database allows connections from Vercel's IP ranges

### Step 6: Deploy

1. Click **"Deploy"** in Vercel
2. Wait for the build to complete
3. Your app will be available at `https://your-app-name.vercel.app`

### Step 7: Run Database Migrations

After successful deployment:

1. **Install Vercel CLI locally:**
   ```bash
   npm i -g vercel
   ```

2. **Login and link your project:**
   ```bash
   vercel login
   vercel link
   ```

3. **Pull environment variables and run migrations:**
   ```bash
   vercel env pull .env.local
   bun run db:migrate
   ```

## 🔧 Post-Deployment Checklist

### Test Your Application
- [ ] Visit your deployed URL
- [ ] Test user authentication (Clerk login)
- [ ] Create a new chat thread
- [ ] Send a test message
- [ ] Verify database connections
- [ ] Check API endpoints work correctly

### Monitor Performance
- [ ] Check Vercel function logs for errors
- [ ] Monitor response times
- [ ] Verify all environment variables are set correctly

## 🛠️ Troubleshooting

### Common Issues and Solutions

#### 1. Build Failures
**Problem:** Build fails with dependency errors
**Solution:**
- Ensure all dependencies are properly installed
- Check that `package.json` includes all required packages
- Verify build commands are correct

#### 2. Database Connection Issues
**Problem:** Can't connect to database
**Solution:**
- Double-check `DATABASE_URL` format
- Ensure database allows connections from Vercel
- Verify database credentials are correct

#### 3. API Routes Not Working
**Problem:** Frontend can't reach API endpoints
**Solution:**
- Verify `VITE_API_BASE_URL` points to your Vercel domain
- Check `vercel.json` routing configuration
- Ensure serverless functions are properly configured

#### 4. Clerk Authentication Issues
**Problem:** Login/authentication not working
**Solution:**
- Verify both `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`
- Check Clerk dashboard for domain configuration
- Ensure Vercel domain is added to Clerk allowed origins

#### 5. Environment Variables Not Loading
**Problem:** App can't access environment variables
**Solution:**
- Verify variables are set in Vercel dashboard
- Check variable names match exactly (case-sensitive)
- Redeploy after adding new variables

## 📊 Performance Optimization

### After Successful Deployment

1. **Enable Analytics:**
   - Go to Vercel dashboard → Analytics
   - Monitor Core Web Vitals and performance metrics

2. **Optimize Loading:**
   - Monitor bundle sizes in build output
   - Consider additional code splitting if needed
   - Optimize images and assets

3. **Database Performance:**
   - Monitor database connection pool usage
   - Set up database monitoring
   - Consider implementing connection pooling

## 🔒 Security Considerations

- [ ] Verify all API keys are properly secured
- [ ] Ensure no sensitive data is logged
- [ ] Check CORS settings are appropriate
- [ ] Review database access permissions
- [ ] Enable Vercel security headers

## 📞 Need Help?

If you encounter issues:
1. Check Vercel function logs in your dashboard
2. Review the build logs for detailed error messages
3. Verify environment variables are correctly set
4. Test API endpoints individually
5. Check database connectivity

## 🎉 Success!

Once deployed successfully, your AI Smart Therapist application will be live and accessible at your Vercel URL. The application supports:
- User authentication via Clerk
- Real-time chat functionality
- AI-powered therapy sessions
- Progress tracking and analytics
- Responsive design for all devices

Happy deploying! 🚀