# Deployment Documentation

This directory contains comprehensive deployment guides for your Mental Health AI Chat application across different platforms and methods.

## 📁 Available Deployment Guides

### Cloud Platforms
- **[Vercel](./vercel.md)** - Full-stack deployment with integrated database
- **[Railway](./railway.md)** - Native Bun support with PostgreSQL
- **[DigitalOcean](./digitalocean.md)** - App Platform with managed services

### Containerization
- **[Docker](./docker.md)** - Complete containerization guide with Docker Compose

## 🚀 Quick Start Recommendations

### For Beginners
**Vercel** - Easiest setup with automatic deployments and built-in database support.

### For Production
**Railway** or **DigitalOcean** - Better scaling options and more control over infrastructure.

### For Custom Infrastructure
**Docker** - Maximum flexibility and portability across any cloud provider.

## 📋 Pre-Deployment Checklist

### Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string
- `CLERK_SECRET_KEY` - Clerk authentication secret
- `CLERK_PUBLISHABLE_KEY` - Clerk public key  
- `GOOGLE_AI_API_KEY` - Google AI API key
- `NODE_ENV` - Environment (production/development)

### Database Setup
1. Choose a PostgreSQL provider (Vercel Postgres, Railway, Supabase, etc.)
2. Create database and note connection details
3. Run database migrations: `bun run db:migrate`

### Authentication Setup
1. Create Clerk application
2. Configure allowed domains
3. Set up OAuth providers if needed

## 🏗️ Application Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Database      │
│   (React/Vite)  │────│   (Bun/Hono)    │────│  (PostgreSQL)   │
│   Port: 3000    │    │   Port: 3000    │    │   Port: 5432    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 Build Requirements

### Frontend
- **Runtime**: Node.js 18+ or Bun
- **Build Tool**: Vite
- **Package Manager**: Bun (recommended)

### Backend  
- **Runtime**: Bun 1.1.29+
- **Framework**: Hono
- **Database**: Drizzle ORM + PostgreSQL

## 📊 Platform Comparison

| Platform | Ease of Use | Cost | Scaling | Bun Support | Database |
|----------|-------------|------|---------|-------------|----------|
| **Vercel** | ⭐⭐⭐⭐⭐ | $ | ⭐⭐⭐ | ✅ | Included |
| **Railway** | ⭐⭐⭐⭐ | $$ | ⭐⭐⭐⭐ | ✅ | Included |
| **DigitalOcean** | ⭐⭐⭐ | $$ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Included |
| **Docker** | ⭐⭐ | $$$ | ⭐⭐⭐⭐⭐ | ✅ | External |

## 🛠️ Development vs Production

### Development
- Use local PostgreSQL or development tier databases
- Enable hot reloading and debug mode
- Use development Clerk environment
- Set `NODE_ENV=development`

### Production
- Use production-grade database with backups
- Enable SSL/TLS encryption
- Use production Clerk environment  
- Set `NODE_ENV=production`
- Configure proper logging and monitoring

## 🔒 Security Considerations

### Environment Variables
- Never commit secrets to version control
- Use platform-specific secret management
- Rotate API keys regularly

### Database Security
- Use SSL connections in production
- Implement proper access controls
- Regular backup scheduling

### Network Security
- Configure CORS properly
- Use HTTPS in production
- Implement rate limiting

## 📈 Monitoring and Maintenance

### Health Checks
All deployment guides include health check endpoints at `/api/health`

### Logging
- Use platform-specific logging solutions
- Monitor error rates and performance
- Set up alerts for critical issues

### Updates
- Set up CI/CD pipelines for automatic deployments
- Test in staging before production
- Monitor post-deployment metrics

## 🆘 Troubleshooting

### Common Issues
1. **Build Failures**: Check Node.js/Bun versions and dependencies
2. **Database Connection**: Verify connection string format and network access
3. **Environment Variables**: Ensure all required variables are set
4. **CORS Issues**: Configure allowed origins in your Hono app

### Getting Help
- Check platform-specific documentation
- Review application logs for error details
- Test components individually (database, API, frontend)

## 📚 Additional Resources

- [Bun Documentation](https://bun.sh/docs)
- [Hono Documentation](https://hono.dev)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [Clerk Authentication](https://clerk.com/docs)

---

Choose the deployment method that best fits your needs and follow the corresponding guide for detailed setup instructions.