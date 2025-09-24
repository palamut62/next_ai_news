# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Build**: `npm run build` - Builds the Next.js application for production
- **Development**: `npm run dev` - Starts the development server
- **Linting**: `npm run lint` - Runs ESLint to check code quality
- **Production**: `npm run start` - Starts the production server

## Architecture Overview

This is an AI-powered tweet automation application built with Next.js 14, TypeScript, and Tailwind CSS. The application monitors tech news sources and GitHub repositories to automatically generate and schedule tweets.

### Directory Structure

- **`app/`** - Next.js App Router pages and API routes
  - `api/` - Backend API endpoints for authentication, tweets, GitHub integration, etc.
  - Route-based pages: `/github`, `/notifications`, `/settings`, `/statistics`, `/tweets`
- **`components/`** - React components including UI components and business logic components
  - `ui/` - Reusable UI components (likely shadcn/ui based)
  - Core components: `auth-wrapper.tsx`, `dashboard-layout.tsx`, `sidebar.tsx`, etc.
- **`lib/`** - Utility functions and shared logic
  - `types.ts` - TypeScript type definitions for the entire application
  - `auth.tsx` - Authentication logic
  - `notification-service.ts` - Notification handling
- **`hooks/`** - Custom React hooks
- **`styles/`** - Styling files
- **`public/`** - Static assets

### Key Technologies

- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS v4+ with shadcn/ui components
- **UI Components**: Radix UI primitives
- **State Management**: React Hook Form with Zod validation
- **TypeScript**: Strict mode enabled
- **Authentication**: Custom auth wrapper system

### Core Features

1. **Tweet Automation**: Monitors TechCrunch articles and GitHub repositories
2. **AI Integration**: Supports multiple AI providers (Gemini, OpenAI, Claude)
3. **Dashboard**: Real-time statistics and activity monitoring
4. **Notifications**: Email and Telegram notification support
5. **Settings Management**: Comprehensive configuration for automation, GitHub monitoring, and integrations

### Important Notes

- Build configuration ignores TypeScript and ESLint errors during builds (`next.config.mjs`)
- Uses path alias `@/*` for imports
- Environment variables are configured for multiple external services (Twitter API, AI providers, email, GitHub)
- Tweet workflow: pending → approved/rejected → posted with engagement tracking