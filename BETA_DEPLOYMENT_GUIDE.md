# 🚀 Beta Testing Deployment Guide

This guide will help you deploy your Mental Health AI Chat Application for beta testing using Vercel.

## 📋 Prerequisites

- ✅ Supabase database (you already have this)
- ✅ GitHub account
- ✅ Vercel account (free tier is sufficient)
- ✅ Your API keys ready

## 🚀 Step-by-Step Deployment

### Step 1: Push to GitHub

1. **Create a new repository** on GitHub (if not already done)
2. **Push your code** to the repository:
   ```bash
   git add .
   git commit -m "Prepare for beta deployment"
   git push origin main
   ```

### Step 2: Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"New Project"**
3. **Import** your GitHub repository
4. **Configure the project:**
   - Framework Preset: **Other**
   - Root Directory: **Leave empty (root)**
   - Build Command: `cd frontend && bun install && bun run build`
   - Output Directory: `frontend/dist`
   - Install Command: `bun install`

### Step 3: Environment Variables

In your Vercel project settings, add these environment variables:

#### **Production Environment Variables:**
```env
# Database (your Supabase URL)
DATABASE_URL=postgresql://postgres:[password]@[host]:[port]/[database]

# AI API Key
GOOGLE_AI_API_KEY=your_google_ai_api_key

# Clerk Authentication  
CLERK_SECRET_KEY=your_clerk_secret_key
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

# Application Settings
NODE_ENV=production
```

**⚠️ Important:** After deployment, update `VITE_API_BASE_URL` to your Vercel URL:
```env
VITE_API_BASE_URL=https://your-app-name.vercel.app/api
```

### Step 4: Deploy

1. Click **"Deploy"** in Vercel
2. Wait for the build to complete (2-3 minutes)
3. Your app will be live at `https://your-app-name.vercel.app`

### Step 5: Post-Deployment Setup

#### **Run Database Migrations**
```bash
# Install Vercel CLI (optional, for easier management)
npm install -g vercel

# Pull environment variables locally
vercel env pull .env.local

# Run migrations  
bun run db:migrate
```

**Or manually run migrations using your local setup with production DATABASE_URL**

#### **Test Your Deployment**

1. **Frontend**: `https://your-app-name.vercel.app`
2. **Backend Health**: `https://your-app-name.vercel.app/api/health`
3. **API Endpoints**: `https://your-app-name.vercel.app/api/*`

## 🧪 Beta Testing Checklist

### **Functional Testing:**
- [ ] Frontend loads correctly
- [ ] User registration/login works (Clerk)
- [ ] Chat functionality works
- [ ] Database operations work
- [ ] AI responses are generated
- [ ] All forms and interactions work

### **Performance Testing:**
- [ ] Page load times are acceptable
- [ ] API response times are reasonable
- [ ] Mobile responsiveness works
- [ ] Cross-browser compatibility

### **Share with Beta Testers:**
```
🧪 Beta Test Link: https://your-app-name.vercel.app

📋 What to Test:
- User registration and login
- Chat functionality  
- Form submissions
- Mobile experience
- Report any bugs or feedback

📧 Feedback: [your-email@example.com]
```

## 🔧 Common Issues & Solutions

### **Build Failures**
```bash
# If build fails, check these:
1. All dependencies in package.json
2. Environment variables set correctly
3. No TypeScript errors in frontend
4. API routes are working
```

### **API Not Working**
```bash
# Check:
1. Environment variables in Vercel dashboard
2. Database connection string is correct
3. All required API keys are set
4. Check function logs in Vercel dashboard
```

### **Frontend Issues**
```bash
# Common fixes:
1. Update VITE_API_BASE_URL to your Vercel domain
2. Check Clerk keys are production keys
3. Verify all environment variables
```

## 📊 Monitoring & Analytics

### **Vercel Dashboard**
- **Functions**: Monitor API performance
- **Analytics**: Track user engagement
- **Logs**: Debug issues in real-time

### **Performance Monitoring**
- Enable Vercel Analytics
- Monitor Core Web Vitals
- Track API response times

## 💰 Cost Considerations

### **Vercel Free Tier Includes:**
- 100GB bandwidth/month
- 1000 serverless function invocations/day
- Custom domains
- SSL certificates

### **Upgrade Triggers:**
- High traffic (>100GB/month)
- Heavy API usage (>1000/day)
- Need for advanced features

## 🚀 Advanced Options

### **Custom Domain**
1. Add domain in Vercel dashboard
2. Configure DNS records
3. SSL automatically provided

### **Environment-Specific Deployments**
```bash
# Staging environment
vercel --prod --environment staging

# Production environment  
vercel --prod --environment production
```

### **Team Collaboration**
- Invite team members in Vercel dashboard
- Set up different environments (dev/staging/prod)
- Configure automated deployments

## 📞 Support & Resources

- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **Clerk Docs**: https://clerk.com/docs

## ✅ Deployment Checklist

Before going live:
- [ ] All environment variables configured
- [ ] Database migrations completed
- [ ] Health endpoint responds correctly
- [ ] Authentication works end-to-end
- [ ] AI functionality tested
- [ ] Mobile experience verified
- [ ] Error handling tested
- [ ] Beta tester instructions prepared

---

**🎉 Your Mental Health AI Chat Application is now ready for beta testing!**

Share the live URL with your beta testers and gather feedback for improvements.