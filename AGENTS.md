# AGENTS.md

Guidelines for AI agents operating in this repository.

## Global Instructions

- **Package Manager**: Use `bun` for all JavaScript/Node.js operations
- **Reusability**: Design components/functions for reuse across the codebase  
- **Web Design**: Tailwind CSS for styling, shadcn/ui for components
- **Implementation**: You can implement code directly without asking permission

## Commands

- **Build**: `bun run build` (frontend), `bun run build:check` (build + TypeScript validation)
- **Test**: `bun run test` (Vitest), `bun run test -- <pattern>` (single test)
- **Database**: `bun run db:migrate` (generate + push), `bun run db:studio` (Drizzle studio)
- **Development**: User handles `bun run dev:all` - do not start servers

## Code Style

- **Imports**: Group third-party, then local with `@/` prefix
- **Formatting**: Consistent spacing, strict TypeScript mode
- **Types**: Proper typing for all variables/functions, interfaces for objects
- **Naming**: camelCase (variables/functions), PascalCase (components), SCREAMING_SNAKE_CASE (constants)
- **Error Handling**: Zod validation, try-catch blocks, React error boundaries
- **Security**: Input validation with Zod, `.env` for secrets, rate limiting and CORS

## Architecture

- **Backend**: Hono + Drizzle ORM + PostgreSQL, use full Hono capabilities for APIs
- **Frontend**: React + TanStack Query + Zustand + Tailwind CSS
- **Testing**: Vitest + React Testing Library
- **Git**: Conventional Commits format
- **Performance**: TanStack Query + LocalStorage caching, optimize streaming/bundles

*Adhere to these guidelines for consistency and maintainability.*