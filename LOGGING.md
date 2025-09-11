# Logging Configuration

## Overview

This project now uses environment-aware logging that respects production vs development environments.

## How it Works

### Logger Utility (`server/lib/logger.ts`)

The logger utility provides console logging only in development mode:
- **Development**: All logger calls output to console
- **Production**: Logger calls are suppressed (no console output)

### Environment Detection

```typescript
const isDevelopment = process.env.NODE_ENV !== 'production';
```

### Available Methods

- `logger.log()` - General logging (development only)
- `logger.error()` - Error logging (development only)
- `logger.warn()` - Warning logging (development only)
- `logger.info()` - Info logging (development only)
- `logger.debug()` - Debug logging (development only)

## File Logging

File logging operations (like conversation saving) still use `console.error` for critical file operation errors since these need to be captured regardless of environment.

## Usage

Replace all `console.log` statements with `logger.log`:

```typescript
// Old way
console.log("Processing request...");

// New way
import { logger } from "../lib/logger";
logger.log("Processing request...");
```

## Files Updated

The following server files have been updated to use the new logger:

- `server/db/config.ts`
- `server/index.ts`
- `server/middleware/admin.ts`
- `server/routes/admin.ts`
- `server/routes/chat.ts`
- `server/routes/generate-form.ts`
- `server/routes/impersonateObserver.ts`
- `server/routes/impostor.ts`
- `server/routes/mainObserver.ts`
- `server/routes/observer.ts`
- `server/routes/patient.ts`
- `server/routes/quality.ts`
- `server/routes/threads.ts`
- `server/routes/user.ts`

## Benefits

1. **Clean Production Logs**: No console clutter in production
2. **Development Visibility**: Full logging available during development
3. **File Logging Preserved**: Critical file operations still logged
4. **Easy Toggle**: Single environment variable controls behavior