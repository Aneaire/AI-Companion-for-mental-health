# Logging Configuration

## Overview

This project uses environment-aware logging that respects production vs development environments, plus comprehensive file logging for debugging and analysis.

## Console Logging (Environment-Aware)

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

## File Logging (Always Active)

### Log Directories

The following directories are automatically created for file logging:

- `chat_logs/` - Conversation logs from therapy sessions
- `observer_logs/` - User strategy analysis logs
- `main_observer_logs/` - Main chat therapy analysis logs  
- `impersonate_observer_logs/` - Impersonation analysis logs
- `server_logs/generate-form/` - Form generation system logs

### File Logging Features

- **Automatic Directory Creation**: All log directories created with `await fs.promises.mkdir(dir, { recursive: true })`
- **Consistent Async Operations**: All file operations use `await fs.promises.writeFile()`
- **Error Handling**: File operation errors still use `console.error` for critical debugging
- **Git Ignored**: All log directories are in `.gitignore` to prevent log file commits

### File Logging Patterns

```typescript
// Directory creation (standardized across all routes)
const logsDir = path.join(process.cwd(), "log_directory_name");
await fs.promises.mkdir(logsDir, { recursive: true });

// File writing
await fs.promises.writeFile(filepath, content, "utf8");
```

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

### Console Logging Updates
All server files updated to use environment-aware logger:

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

### File Logging Standardization
All file logging operations standardized to use async patterns:

- `server/routes/chat.ts` - Conversation logging
- `server/routes/generate-form.ts` - Form generation logs
- `server/routes/observer.ts` - Strategy analysis logs
- `server/routes/mainObserver.ts` - Therapy analysis logs
- `server/routes/impersonateObserver.ts` - Impersonation analysis logs

## Benefits

1. **Clean Production Logs**: No console clutter in production
2. **Development Visibility**: Full logging available during development  
3. **Comprehensive File Logging**: Detailed logs for debugging and analysis
4. **Consistent Async Operations**: No more ENOENT directory errors
5. **Easy Toggle**: Single environment variable controls console behavior
6. **Automatic Setup**: Log directories created automatically when needed