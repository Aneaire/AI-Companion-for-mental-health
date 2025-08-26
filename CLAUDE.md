# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Starting the Application
- `bun run dev:all` - Start both frontend and backend concurrently
- `bun run dev:frontend` - Start only the frontend (React + Vite on port 3000)
- `bun run dev:server` - Start only the backend server (Bun + Hono on port 4000)

### Database Management
- `bun run db:generate` - Generate database migrations
- `bun run db:push` - Push schema changes to database
- `bun run db:migrate` - Generate and push schema changes (combined)
- `bun run db:studio` - Open Drizzle Studio for database inspection

### Testing and Building
- `bun run test` (frontend only) - Run Vitest tests
- `bun run build` (frontend only) - Build production frontend with TypeScript check

## Project Architecture

This is a mental health AI chat assistant with a real-time streaming chat interface built using modern full-stack TypeScript.

### Backend Architecture
- **Framework**: Hono.js for fast, lightweight API endpoints
- **Runtime**: Bun for performance and TypeScript support
- **Database**: PostgreSQL with Drizzle ORM
- **API Structure**: RESTful endpoints with real-time streaming responses
- **Key Routes**: 
  - `/api/chat` - Main chat functionality with streaming
  - `/api/threads` - Session and thread management
  - `/api/impostor` - Impersonation/role-play features
  - `/api/user`, `/api/patient`, `/api/observer`, `/api/quality` - Supporting features

### Frontend Architecture
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite for fast development
- **Routing**: TanStack Router for type-safe routing
- **State Management**: Zustand with persistence for chat state
- **Data Fetching**: TanStack Query for server state management
- **Authentication**: Clerk for user management
- **UI Components**: Custom components built on Radix UI primitives with Tailwind CSS
- **Styling**: Tailwind CSS v4 with custom animations

### Database Schema
The application uses a sophisticated schema supporting:
- **Users**: Clerk-based authentication with user profiles
- **Threads**: Main conversation containers with session preferences
- **Sessions**: Individual therapy sessions (1-5 per thread)
- **Messages**: Chat messages linked to sessions or impersonate threads
- **Impersonate Threads**: Role-play conversations with personas
- **Session Forms**: Structured data collection for therapy sessions

Key relationships:
- Users → Threads → Sessions → Messages
- Users → Impersonate Threads → Messages
- Users → Personas (for role-play)

### Key Features Implementation
1. **Real-time Streaming**: Uses ReadableStream for AI response streaming
2. **Session Management**: Automatic session creation and management (max 5 sessions per thread)
3. **Form Generation**: Dynamic form creation based on conversation context
4. **Quality Analysis**: AI-powered conversation quality assessment
5. **Observer Mode**: AI suggestions for conversation improvement
6. **Impersonation**: Role-play mode with persona-based conversations

### State Management Patterns
- **Chat State**: Zustand store with localStorage persistence for preferences only
- **API Client**: Type-safe Hono client with automatic type inference
- **Context Management**: Conversation contexts cached per thread/session
- **Loading States**: Granular loading states (idle, observer, generating, streaming)

### Important Conventions
- Use Bun as package manager (`bun install`, `bun run`)
- All API endpoints return proper HTTP status codes with error handling
- Frontend uses TanStack Query for caching and error boundary patterns
- Database migrations are handled through Drizzle Kit
- Streaming responses use proper cleanup with AbortController
- LocalStorage is used selectively - only for user preferences, not conversation data

### Development Workflow
- Backend runs on port 4000, frontend on port 3000
- Hot reload enabled for both frontend and backend
- TypeScript strict mode enabled across the project
- Use existing component patterns when adding new UI
- Follow the established API patterns when adding new endpoints
- Database schema changes require migration generation

### Testing
- Frontend uses Vitest + React Testing Library
- Test files should follow existing patterns in the components
- Run tests with `bun run test` in the frontend directory