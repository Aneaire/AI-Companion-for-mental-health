# 🚀 Deploy to Vercel with Supabase

Follow these steps to deploy your Mental Health AI Chat application to Vercel with Supabase as your database.

## 📋 Prerequisites

✅ **Completed Setup:**
- [x] Vercel account
- [x] Supabase database configured
- [x] GitHub repository
- [x] Clerk authentication setup

## 🔧 Step 1: Prepare Your Repository

The following files have been created/updated for deployment:

### Files Created:
- ✅ `vercel.json` - Vercel configuration
- ✅ `.env.vercel.example` - Environment variables template

### Files Updated:
- ✅ `package.json` - Added build script
- ✅ `server/db/config.ts` - Updated to use environment variables

## 🌍 Step 2: Set Environment Variables in Vercel

Go to your Vercel dashboard and add these environment variables:

### Required Variables:

```bash
# Database (Your Supabase URL)
DATABASE_URL=postgresql://postgres.anihhhqfauctpckwcbfg:WVZedWvtL5eOlwIV@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres

# Clerk Authentication (Get from Clerk Dashboard)
CLERK_SECRET_KEY=sk_test_your_secret_key_here
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here

# Google AI (Get from Google AI Studio)
GOOGLE_AI_API_KEY=your_google_ai_api_key_here

# Application Environment
NODE_ENV=production
VITE_API_BASE_URL=https://your-app-name.vercel.app/api
```

### How to Add Variables in Vercel:
1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable above
4. Set **Environment** to "Production, Preview, and Development"

## 🚀 Step 3: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard (Recommended)

1. **Connect GitHub Repository:**
   ```
   1. Go to https://vercel.com/new
   2. Import your GitHub repository
   3. Configure project settings:
      - Framework Preset: Other
      - Root Directory: ./
      - Build Command: bun run build
      - Output Directory: frontend/dist
      - Install Command: bun install
   ```

2. **Deploy:**
   ```
   1. Click "Deploy"
   2. Wait for build to complete
   3. Your app will be available at https://your-app-name.vercel.app
   ```

### Option B: Deploy via Vercel CLI

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login and Deploy:**
   ```bash
   # Login to Vercel
   vercel login
   
   # Deploy from project root
   vercel
   
   # For production deployment
   vercel --prod
   ```

## 🗄️ Step 4: Run Database Migrations

After successful deployment, you need to run your database migrations:

### Option A: Via Vercel Dashboard
1. Go to your project dashboard
2. Navigate to **Functions** tab
3. Find your deployed function
4. Open the function logs to verify database connection

### Option B: Via CLI (if you have migration issues)
```bash
# Set your production DATABASE_URL locally
export DATABASE_URL="your_supabase_connection_string"

# Run migrations
bun run db:migrate
```

## ✅ Step 5: Verify Deployment

### Check These Endpoints:
1. **Frontend:** `https://your-app-name.vercel.app`
2. **API Health:** `https://your-app-name.vercel.app/api/health`
3. **Database Connection:** Check your Supabase dashboard for new connections

### Test Functionality:
- [ ] Frontend loads correctly
- [ ] User authentication works (Clerk)
- [ ] API endpoints respond
- [ ] Database queries work
- [ ] AI chat functionality works

## 🔧 Step 6: Update Environment Variables

After deployment, update your `VITE_API_BASE_URL`:

```bash
VITE_API_BASE_URL=https://your-actual-vercel-app.vercel.app/api
```

**Important:** Replace `your-actual-vercel-app` with your actual Vercel app URL.

## 🎯 Step 7: Configure Clerk for Production

Update your Clerk application settings:

1. **Allowed Origins:**
   ```
   https://your-app-name.vercel.app
   ```

2. **Redirect URLs:**
   ```
   https://your-app-name.vercel.app/
   https://your-app-name.vercel.app/dashboard
   ```

## 🔍 Troubleshooting

### Common Issues:

1. **Build Fails:**
   ```bash
   # Check build logs in Vercel dashboard
   # Ensure all dependencies are in package.json
   # Verify environment variables are set
   ```

2. **Database Connection Error:**
   ```bash
   # Verify DATABASE_URL is correct
   # Check Supabase connection limits
   # Ensure database is accessible from Vercel
   ```

3. **API Routes Not Working:**
   ```bash
   # Check vercel.json configuration
   # Verify function deployment in Vercel dashboard
   # Check function logs for errors
   ```

4. **Frontend Shows Errors:**
   ```bash
   # Update VITE_API_BASE_URL with correct domain
   # Check browser console for specific errors
   # Verify Clerk configuration
   ```

## 📊 Monitoring Your Deployment

1. **Vercel Analytics:** Monitor performance and usage
2. **Function Logs:** Check API function execution
3. **Supabase Dashboard:** Monitor database queries and connections
4. **Clerk Dashboard:** Track authentication metrics

## 🎉 Next Steps

After successful deployment:

1. **Custom Domain:** Add your custom domain in Vercel settings
2. **SSL Certificate:** Automatically handled by Vercel
3. **CDN:** Your assets are automatically distributed via Vercel's CDN
4. **Monitoring:** Set up error tracking (Sentry, etc.)

## 📝 Notes

- Your Supabase connection string is already configured
- Database migrations will run automatically on build
- All static assets are served via Vercel's CDN
- API functions are serverless and scale automatically

---

**Need help?** Check the Vercel deployment documentation at `deployment/vercel.md` for more detailed information.