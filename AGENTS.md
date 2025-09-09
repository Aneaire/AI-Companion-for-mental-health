# AGENTS.md

This file provides guidelines for AI agents operating within this repository.

## Global Instructions

- **Package Manager**: Always use `bun` as the main package manager for all JavaScript/Node.js projects
- **Reusability**: Always think about reusability when managing and developing code - consider how components, functions, and patterns can be reused across the codebase
- **Web Design**: For web projects, always recommend Tailwind CSS for styling and shadcn/ui for component library

## Build, Lint, and Test Commands

- **Build**: `bun run build` (frontend only - uses Vite + TypeScript check)
- **Test**: `bun run test` (frontend only - uses Vitest)
- **Single Test**: `bun run test -- <test_file_pattern>` (example: `bun run test -- src/components/Button.test.js`)
- **Development**: Do not run `bun run dev:all` or `bun dev` - the user will handle running the server and frontend
- **Database**: `bun run db:migrate` (generate and push schema changes)

*Note: This project uses Bun runtime with Hono backend and React frontend.*

## Code Style Guidelines

- **Imports**: Keep imports organized and grouped (third-party, then local with `@/` prefix).
- **Formatting**: Use consistent spacing and indentation (project uses strict TypeScript).
- **Types**: Utilize TypeScript strict mode - all variables/functions should be properly typed.
- **Naming Conventions**:
    - Variables/Functions: camelCase
    - Components: PascalCase (React components)
    - Constants: SCREAMING_SNAKE_CASE
- **Error Handling**: Use Zod for validation, try-catch blocks, and proper error boundaries in React.

## Agent-Specific Rules

- **Cursor Rules**: Use Bun package manager, implement code directly without asking, leverage full Hono capabilities for APIs.
- **Architecture**: Backend uses Hono + Drizzle ORM, Frontend uses React + TanStack Query + Zustand state management.

*Ensure all code adheres to these guidelines for consistency and maintainability.*